import requests
from django.conf import settings


class GraphClient:
    """HTTP client for graph-service. Forwards the user's JWT for auth."""

    def __init__(self, token: str):
        self._base_url = settings.GRAPH_SERVICE_URL.rstrip("/")
        self._headers = {"Authorization": f"Bearer {token}"}

    def search_concepts(self, query: str) -> list[dict]:
        response = requests.get(
            f"{self._base_url}/api/v1/graph/search/",
            params={"q": query},
            headers=self._headers,
            timeout=10,
        )
        response.raise_for_status()
        return response.json().get("results", [])
