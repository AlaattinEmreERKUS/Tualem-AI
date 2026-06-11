from apps.repositories.graph_repository import GraphRepository
from apps.service.graph_rag_service import GraphRAGService
from apps.exceptions.graph_exceptions import (
    DocumentNotFoundException,
    DocumentDeleteException,
    DocumentAccessDeniedException,
    TaskNotFoundException,
)


class GraphService:

    @staticmethod
    def get_documents(user_id, room_id=None):
        return GraphRepository.get_document_list(user_id, room_id=room_id)

    @staticmethod
    def get_document(document_id, user_id):
        document = GraphRepository.get_document_by_id(document_id, user_id)
        if not document:
            raise DocumentNotFoundException(document_id)
        return document

    @staticmethod
    def upload_document(user_id, file_name, file_type, file, room_id=None):
        document = GraphRepository.create_document(user_id, file_name, file_type, file, room_id=room_id)

        try:
            task = GraphRepository.create_task(document.id)
        except Exception:
            GraphRepository.update_document_status(document.id, 'failed')
            raise

        from apps.tasks import run_graph_pipeline
        run_graph_pipeline.delay(str(document.id), str(task.id))

        return {"document_id": str(document.id), "task_id": str(task.id)}

    @staticmethod
    def delete_document(document_id, user_id):
        import logging
        _log = logging.getLogger('graph_module')
        document = GraphRepository.get_document_by_id(document_id, user_id)
        _log.info("[delete] doc=%s req_user=%r stored_user=%r found=%s",
                  document_id, str(user_id), document.get('user_id') if document else None, bool(document))
        if not document:
            raise DocumentAccessDeniedException()

        try:
            GraphRAGService.cleanup_document(document_id)
        except Exception:
            import logging
            logging.getLogger('graph_module').warning(
                "cleanup_document failed for %s — proceeding with DB delete", document_id
            )

        deleted = GraphRepository.delete_document(document_id, user_id)
        if not deleted:
            raise DocumentDeleteException()

    @staticmethod
    def get_task_status(document_id):
        task = GraphRepository.get_task_by_document(document_id)
        if not task:
            raise TaskNotFoundException()
        return task

    @staticmethod
    def get_chunks(document_id, user_id):
        document = GraphRepository.get_document_by_id(document_id, user_id)
        if not document:
            raise DocumentNotFoundException(document_id)

        return GraphRepository.get_chunks_by_document(document_id)
