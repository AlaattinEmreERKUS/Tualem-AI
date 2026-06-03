from apps.models import Document, ContentChunk, GraphTask

class GraphRepository:

    # --- Document ---

    @staticmethod
    def get_document_list(user_id, room_id=None):
        try:
            qs = Document.objects.filter(user_id=str(user_id))
            if room_id:
                qs = qs.filter(room_id=str(room_id))
            return qs.values()
        except Exception:
            return None

    @staticmethod
    def get_document_by_id(document_id, user_id):
        try:
            return Document.objects.filter(id=document_id, user_id=user_id).values().first()
        except Exception:
            return None

    @staticmethod
    def create_document(user_id, file_name, file_type, file, room_id=None):
        try:
            instance = Document(
                user_id=user_id,
                room_id=room_id,
                file_name=file_name,
                file_type=file_type,
                file=file,
                status='pending'
            )
            instance.save()
            return instance
        except Exception:
            return None

    @staticmethod
    def update_document_status(document_id, status):
        try:
            return Document.objects.filter(id=document_id).update(status=status) > 0
        except Exception:
            return False

    @staticmethod
    def delete_document(document_id, user_id):
        try:
            count, _ = Document.objects.filter(id=document_id, user_id=user_id).delete()
            return count > 0
        except Exception:
            return False

    # --- ContentChunk ---

    @staticmethod
    def get_chunks_by_document(document_id):
        try:
            return list(ContentChunk.objects.filter(document_id=document_id).order_by('chunk_index').values())
        except Exception:
            return None

    @staticmethod
    def create_chunks(document_id, chunks: list[str]):
        try:
            instances = [
                ContentChunk(document_id=document_id, content=text, chunk_index=i)
                for i, text in enumerate(chunks)
            ]
            ContentChunk.objects.bulk_create(instances)
            return [str(c.id) for c in instances]
        except Exception:
            return None

    @staticmethod
    def mark_chunk_embedded(chunk_id):
        try:
            return ContentChunk.objects.filter(id=chunk_id).update(is_embedded=True) > 0
        except Exception:
            return False

    # --- GraphTask ---

    @staticmethod
    def create_task(document_id):
        try:
            task = GraphTask(document_id=document_id)
            task.save()
            return task
        except Exception:
            return None

    @staticmethod
    def get_task_by_document(document_id):
        try:
            return GraphTask.objects.filter(document_id=document_id).values().last()
        except Exception:
            return None

    @staticmethod
    def update_task_step(task_id, step, error_message=None):
        try:
            return GraphTask.objects.filter(id=task_id).update(
                current_step=step,
                error_message=error_message
            ) > 0
        except Exception:
            return False