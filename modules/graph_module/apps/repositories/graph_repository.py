from apps.models import Document, ContentChunk, GraphTask

class GraphRepository:

    # --- Document ---

    @staticmethod
    def get_document_list(user_id, room_id=None):
        qs = Document.objects.filter(user_id=str(user_id))
        if room_id:
            qs = qs.filter(room_id=str(room_id))
        return qs.values()

    @staticmethod
    def get_document_by_id(document_id, user_id):
        return Document.objects.filter(id=document_id, user_id=str(user_id)).values().first()

    @staticmethod
    def create_document(user_id, file_name, file_type, file, room_id=None):
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

    @staticmethod
    def update_document_status(document_id, status):
        return Document.objects.filter(id=document_id).update(status=status) > 0

    @staticmethod
    def delete_document(document_id, user_id):
        count, _ = Document.objects.filter(id=document_id, user_id=str(user_id)).delete()
        return count > 0

    # --- ContentChunk ---

    @staticmethod
    def get_chunks_by_document(document_id):
        return list(ContentChunk.objects.filter(document_id=document_id).order_by('chunk_index').values())

    @staticmethod
    def delete_chunks_by_document(document_id):
        qs = ContentChunk.objects.filter(document_id=document_id)
        ids = [str(i) for i in qs.values_list('id', flat=True)]
        qs.delete()
        return ids

    @staticmethod
    def create_chunks(document_id, chunks: list[str]):
        instances = [
            ContentChunk(document_id=document_id, content=text, chunk_index=i)
            for i, text in enumerate(chunks)
        ]
        ContentChunk.objects.bulk_create(instances)
        return [str(c.id) for c in instances]

    @staticmethod
    def mark_chunk_embedded(chunk_id):
        return ContentChunk.objects.filter(id=chunk_id).update(is_embedded=True) > 0

    # --- GraphTask ---

    @staticmethod
    def create_task(document_id):
        task = GraphTask(document_id=document_id)
        task.save()
        return task

    @staticmethod
    def get_task_by_document(document_id):
        return GraphTask.objects.filter(document_id=document_id).values().last()

    @staticmethod
    def update_task_step(task_id, step, error_message=None):
        return GraphTask.objects.filter(id=task_id).update(
            current_step=step,
            error_message=error_message
        ) > 0
