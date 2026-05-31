import os
from apps.vector_store import VectorStore


def _get_neo4j_client():
    from apps.neo4j_client import Neo4jClient
    return Neo4jClient(
        neo4j_uri=os.environ["NEO4J_URI"],
        neo4j_user=os.environ["NEO4J_USER"],
        neo4j_password=os.environ["NEO4J_PASSWORD"],
    )


class RAGRepository:

    @staticmethod
    def vector_search(query: str, user_id: str, top_k: int = 5, room_id: str = None, excluded_doc_ids: list = None) -> list:
        return VectorStore().search(query, user_id, top_k, room_id=room_id, excluded_doc_ids=excluded_doc_ids or [])

    @staticmethod
    def get_graph_context(chunk_ids: list) -> list:
        neo4j = _get_neo4j_client()
        try:
            return neo4j.get_graph_context_by_chunks(chunk_ids)
        finally:
            neo4j.close()

    @staticmethod
    def delete_chunk_nodes(chunk_ids: list) -> None:
        neo4j = _get_neo4j_client()
        try:
            neo4j.delete_chunks(chunk_ids)
        finally:
            neo4j.close()

    @staticmethod
    def delete_document_embeddings(document_id: str) -> None:
        VectorStore().delete_document_embeddings(document_id)
