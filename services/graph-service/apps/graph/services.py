from .repositories import GraphRepository


class GraphService:
    def __init__(self):
        self.repo = GraphRepository()

    def ingest_concepts(self, concepts: list[dict], user_id: int) -> None:
        pass

    def get_graph_for_user(self, user_id: int) -> dict:
        pass

    def search(self, query: str, user_id: int) -> list[dict]:
        pass
