from apps.models import Document, ContentChunk, GraphTask
from typing import List, Optional
import uuid

class GraphRepository:
    
    @staticmethod
    def get_document_list():
        try:
            return Document.objects.values()
        except Exception:
            return None

    @staticmethod
    def get_document_by_id(document_id):
        try:
            return Document.objects.filter(
                document_id = document_id
            ).values().first()
        except Exception:
            return None
        
    @staticmethod
    def create_document(file_name, file_type, file):
        try:
            from django.utils import timezone
            instance = Document(
                file_name = file_name,
                file_type=file_type,
                file=file,
                uploaded_at=timezone.now(),
                status='pending'
            )
            instance.save()
            return instance.id
        except Exception:
            return None
        
    @staticmethod
    def update_document(document_id, file_name, file_type, file):
        try:
            from django.utils import timezone
            updated = Document.objects.filter(
                document_id = document_id
            ).update(
                file_name = file_name,
                file_type = file_type,
                file = file,
                updated_at = timezone.now(),
                status = 'Pending'
            )
            return updated > 0
        except Exception:
            return False
        
    @staticmethod
    def delete_document(document_id):
        try:
            deleted = Document.objects.filter(
                document_id = document_id
            ).delete()
            return deleted > 0
        except Exception:
            return False


    @staticmethod
    def get_contentchunk_list(document_id):
        try:
            return ContentChunk.objects.filter(
                document_id=document_id
            ).values()
        except Exception:
            return None

    @staticmethod
    def get_contentchunk_by_id(document_id, contentchunk_id):
        try:
            return ContentChunk.objects.filter(
                document_id=document_id,
                id = contentchunk_id
            ).values().first()
        except Exception:
            return None