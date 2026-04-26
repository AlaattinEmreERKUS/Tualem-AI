from .neo4j_client import Neo4jClient


class GraphRepository:
    def create_node(self, label: str, properties: dict) -> dict:
        pass

    def create_relationship(self, from_id: str, to_id: str, rel_type: str) -> None:
        pass

    def get_node(self, node_id: str) -> dict:
        pass

    def get_neighbors(self, node_id: str, depth: int = 1) -> list[dict]:
        pass

    def search_nodes(self, query: str, user_id: int) -> list[dict]:
        pass

    def get_subgraph(self, user_id: int) -> dict:
        pass
