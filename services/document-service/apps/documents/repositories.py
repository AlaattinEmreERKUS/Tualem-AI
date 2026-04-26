from .models import Document


class DocumentRepository:
    def get_by_id(self, doc_id: int):
        return Document.objects.filter(id=doc_id).first()

    def get_by_user(self, user_id: int):
        return Document.objects.filter(user_id=user_id)

    def create(self, **kwargs) -> Document:
        return Document.objects.create(**kwargs)

    def update_status(self, doc_id: int, status: str):
        Document.objects.filter(id=doc_id).update(status=status)
