import os
from celery import shared_task
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
