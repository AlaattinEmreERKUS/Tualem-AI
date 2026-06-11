import os
import logging
from celery import shared_task

logger = logging.getLogger('graph_module')
from apps.repositories.graph_repository import GraphRepository
from apps.exceptions.graph_exceptions import PipelineException, EntityExtractionException

PERMANENT_FAILURE_STEPS = {"text_extraction", "chunking"}


def _get_neo4j_client():
    from apps.neo4j_client import Neo4jClient
    return Neo4jClient(
        neo4j_uri=os.environ["NEO4J_URI"],
        neo4j_user=os.environ["NEO4J_USER"],
        neo4j_password=os.environ["NEO4J_PASSWORD"],
    )


def _extract_text(file_path: str, file_type: str) -> str:
    if file_type == "application/pdf":
        from pypdf import PdfReader
        reader = PdfReader(file_path)
        return "\n".join(page.extract_text() or "" for page in reader.pages)

    if file_type in (
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ):
        from docx import Document as DocxDocument
        doc = DocxDocument(file_path)
        return "\n".join(p.text for p in doc.paragraphs)

    if file_type == "application/vnd.ms-powerpoint":
        import struct
        import olefile
        texts = []
        try:
            ole = olefile.OleFileIO(file_path)
            if ole.exists("PowerPoint Document"):
                stream = ole.openstream("PowerPoint Document").read()
                i = 0
                while i < len(stream) - 8:
                    # PPT binary record: verInst(2) + typeCode(2) + length(4)
                    try:
                        type_code = struct.unpack_from("<H", stream, i + 2)[0]
                        rec_len   = struct.unpack_from("<I", stream, i + 4)[0]
                    except struct.error:
                        break
                    data_start = i + 8
                    data_end   = data_start + rec_len
                    if data_end > len(stream):
                        break
                    if type_code == 0x0FA0:  # TextBytesAtom — 1 byte per char
                        texts.append(stream[data_start:data_end].decode("latin-1", errors="ignore"))
                    elif type_code == 0x0FA8:  # TextCharsAtom — UTF-16LE
                        texts.append(stream[data_start:data_end].decode("utf-16-le", errors="ignore"))
                    i = data_end
            ole.close()
        except Exception as e:
            logger.warning(".ppt parse error: %s", e)
        return "\n".join(t.strip() for t in texts if t.strip())

    if file_type == "application/vnd.openxmlformats-officedocument.presentationml.presentation":
        from pptx import Presentation
        prs = Presentation(file_path)
        texts = []
        for slide in prs.slides:
            for shape in slide.shapes:
                if hasattr(shape, "text") and shape.text.strip():
                    texts.append(shape.text.strip())
        return "\n".join(texts)

    with open(file_path, "r", encoding="utf-8") as f:
        return f.read()


@shared_task(bind=True, max_retries=3)
def run_graph_pipeline(self, document_id: str, task_id: str):
    import tempfile

    logger.info("[pipeline] start | doc=%s task=%s", document_id, task_id)

    GraphRepository.update_document_status(document_id, "processing")

    try:
        neo4j = _get_neo4j_client()
    except Exception as e:
        logger.error("[pipeline] Neo4j bağlantısı kurulamadı | doc=%s | error=%s", document_id, e)
        GraphRepository.update_task_step(task_id, "failed", error_message=str(e))
        GraphRepository.update_document_status(document_id, "failed")
        return

    tmp_path = None
    try:
        stale_chunk_ids = GraphRepository.delete_chunks_by_document(document_id)
        if stale_chunk_ids:
            logger.info("[pipeline] cleanup | doc=%s | stale_chunks=%d", document_id, len(stale_chunk_ids))
            neo4j.delete_chunks(stale_chunk_ids)

        GraphRepository.update_task_step(task_id, "text_extraction")
        try:
            from apps.models import Document
            document = Document.objects.get(id=document_id)
            logger.info("[pipeline] text_extraction | doc=%s | file=%s type=%s",
                        document_id, document.file_name, document.file_type)
            suffix = os.path.splitext(document.file_name or "")[1] or ".bin"
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                with document.file.open("rb") as src:
                    for piece in src.chunks():
                        tmp.write(piece)
                tmp_path = tmp.name
            text = _extract_text(tmp_path, document.file_type)
            logger.info("[pipeline] text_extraction ok | doc=%s | chars=%d", document_id, len(text))
        except Exception as e:
            logger.error("[pipeline] text_extraction failed | doc=%s | error=%s", document_id, e)
            raise PipelineException("text_extraction", str(e)) from e

        GraphRepository.update_task_step(task_id, "chunking")
        logger.info("[pipeline] chunking | doc=%s", document_id)
        chunks = neo4j.chunk_text(text)
        if not chunks:
            logger.error("[pipeline] chunking failed: no chunks | doc=%s", document_id)
            raise PipelineException("chunking", "Metin parçalanamadı.")
        chunk_ids = GraphRepository.create_chunks(document_id, chunks)
        logger.info("[pipeline] chunking ok | doc=%s | chunks=%d", document_id, len(chunks))

        GraphRepository.update_task_step(task_id, "entity_extraction")
        logger.info("[pipeline] entity_extraction | doc=%s", document_id)
        for chunk_id, chunk_text in zip(chunk_ids, chunks):
            try:
                graph_data = neo4j.extract_graph_data(chunk_text)
                neo4j.create_chunk_with_entities(
                    chunk_id=chunk_id,
                    entities=graph_data.get("entities", []),
                    relationships=graph_data.get("relationships", []),
                )
            except EntityExtractionException as e:
                logger.warning("[pipeline] entity_extraction skip chunk=%s | %s", chunk_id, e)
                neo4j.create_chunk_node(chunk_id)
                continue

        GraphRepository.update_task_step(task_id, "neo4j_write")
        logger.info("[pipeline] neo4j_write ok | doc=%s", document_id)

        GraphRepository.update_task_step(task_id, "vector_write")
        logger.info("[pipeline] vector_write | doc=%s", document_id)
        from apps.vector_store import VectorStore
        vs = VectorStore()
        chunk_data = [{"id": cid, "content": txt} for cid, txt in zip(chunk_ids, chunks)]
        vs.embed_chunks_bulk(chunk_data)
        logger.info("[pipeline] vector_write ok | doc=%s", document_id)

        GraphRepository.update_task_step(task_id, "completed")
        GraphRepository.update_document_status(document_id, "completed")
        logger.info("[pipeline] COMPLETED | doc=%s", document_id)

    except PipelineException as e:
        logger.error("[pipeline] FAILED at step=%s | doc=%s | error=%s", e.step, document_id, e.message)
        GraphRepository.update_task_step(task_id, "failed", error_message=e.message)
        GraphRepository.update_document_status(document_id, "failed")

        if e.step not in PERMANENT_FAILURE_STEPS:
            raise self.retry(exc=e, countdown=60)

    except Exception as e:
        logger.exception("[pipeline] UNEXPECTED ERROR | doc=%s | error=%s", document_id, e)
        GraphRepository.update_task_step(task_id, "failed", error_message=str(e))
        GraphRepository.update_document_status(document_id, "failed")

    finally:
        neo4j.close()
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
