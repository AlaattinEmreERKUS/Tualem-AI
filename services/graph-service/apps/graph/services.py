from .repositories import GraphRepository


class GraphService:
    def __init__(self):
        self.repo = GraphRepository()

    def ingest_concepts(self, payload: dict, user_id: int) -> None:
        self.repo.ingest(payload, user_id)

    def get_graph_for_user(self, user_id: int) -> dict:
        return self.repo.get_subgraph(user_id)

    def search(self, query: str, user_id: int) -> list[dict]:
        return self.repo.search_nodes(query, user_id)
