from apps.repositories.graph_repository import GraphRepository

class GraphService():

    @staticmethod
    def get_document_list():
        try:
            return GraphRepository.get_document_list()
        except Exception:
            raise
        
    @staticmethod
    def get_document_by_id(document_id):
        try:
            return GraphRepository.get_document_by_id(document_id)
        except Exception:
            raise
        
    @staticmethod
    def create_document(file_name, file_type, file):
        try:
            return GraphRepository.create_document(
                file_name,
                file_type,
                file
            )
        except Exception:
            raise

    @staticmethod
    def update_document(document_id, file_name, file_type, file):
        try:
            return GraphRepository.update_document(
                document_id,
                file_name,
                file_type,
                file
            )
        except Exception:
            raise

    @staticmethod
    def delete_document(document_id):
        try:
            return GraphRepository.delete_document(document_id)
        except Exception:
            raise

    @staticmethod
    def get_contentchunk_list(document_id):
        try:
            return GraphRepository.get_contentchunk_list(document_id)
        except Exception:
            raise

    @staticmethod
    def get_contentchunk_by_id(document_id, contentchunk_id):
        try:
            return GraphRepository.get_contentchunk_by_id(
                document_id,
                contentchunk_id
            )
        except Exception:
            raise