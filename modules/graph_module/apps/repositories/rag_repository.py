import os
from apps.vector_store import VectorStore


class RAGRepository:

    @staticmethod
    def vector_search(query: str, user_id: str, top_k: int = 5) -> list:
        return VectorStore().search(query, user_id, top_k)

    @staticmethod
    def get_graph_context(chunk_ids: list) -> list:
        from apps.neo4j_client import Neo4jClient
        neo4j = Neo4jClient(
            neo4j_uri=os.environ["NEO4J_URI"],
            neo4j_user=os.environ["NEO4J_USER"],
            neo4j_password=os.environ["NEO4J_PASSWORD"],
        )
        try:
            return neo4j.get_graph_context_by_chunks(chunk_ids)
        finally:
            neo4j.close()
