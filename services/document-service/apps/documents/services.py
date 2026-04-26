from .repositories import DocumentRepository
from .models import Document


class DocumentService:
    def __init__(self):
        self.repo = DocumentRepository()

    def upload(self, user_id: int, title: str, file, file_type: str) -> Document:
        pass

    def list_user_documents(self, user_id: int):
        pass

    def get_document(self, doc_id: int, user_id: int):
        pass

    def delete(self, doc_id: int, user_id: int):
        pass
