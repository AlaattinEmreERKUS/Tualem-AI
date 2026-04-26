from config.celery import app
from apps.processor.services import ProcessorService


@app.task(bind=True, max_retries=3)
def process_document(self, document_id: int, file_path: str, file_type: str):
    
    try:
        service = ProcessorService()
        text = service.extract_text(file_path, file_type)
        concepts = service.extract_concepts(text)

    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)
