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
    from apps.models import Document

    try:
        document = Document.objects.get(id=document_id)
    except Document.DoesNotExist:
        return

    GraphRepository.update_document_status(document_id, "processing")
    neo4j = _get_neo4j_client()

    try:
        GraphRepository.update_task_step(task_id, "text_extraction")
        try:
            text = _extract_text(document.file.path, document.file_type)
        except Exception as e:
            raise PipelineException("text_extraction", str(e)) from e

        GraphRepository.update_task_step(task_id, "chunking")
        chunks = neo4j.chunk_text(text)
        if not chunks:
            raise PipelineException("chunking", "Metin parçalanamadı.")
        chunk_ids = GraphRepository.create_chunks(document_id, chunks)
        if not chunk_ids:
            raise PipelineException("chunking", "Chunk'lar kaydedilemedi.")

        GraphRepository.update_task_step(task_id, "entity_extraction")
        for chunk_id, chunk_text in zip(chunk_ids, chunks):
            try:
                graph_data = neo4j.extract_graph_data(chunk_text)
                neo4j.create_chunk_with_entities(
                    chunk_id=chunk_id,
                    entities=graph_data.get("entities", []),
                    relationships=graph_data.get("relationships", []),
                )
            except EntityExtractionException:
                neo4j.create_chunk_node(chunk_id)
                continue

        GraphRepository.update_task_step(task_id, "neo4j_write")

        GraphRepository.update_task_step(task_id, "vector_write")
        from apps.vector_store import VectorStore
        vs = VectorStore()
        chunk_data = [{"id": cid, "content": txt} for cid, txt in zip(chunk_ids, chunks)]
        vs.embed_chunks_bulk(chunk_data)

        GraphRepository.update_task_step(task_id, "completed")
        GraphRepository.update_document_status(document_id, "completed")

    except PipelineException as e:
        GraphRepository.update_task_step(task_id, "failed", error_message=e.message)
        GraphRepository.update_document_status(document_id, "failed")

        if e.step not in PERMANENT_FAILURE_STEPS:
            raise self.retry(exc=e, countdown=60)

    finally:
        neo4j.close()
