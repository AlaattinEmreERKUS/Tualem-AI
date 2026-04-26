from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from .services import GraphService


class IngestConceptsView(APIView):
    def post(self, request):
        service = GraphService()
        service.ingest_concepts(request.data, request.user.id)
        return Response(status=status.HTTP_204_NO_CONTENT)


class UserGraphView(APIView):
    def get(self, request):
        service = GraphService()
        graph = service.get_graph_for_user(request.user.id)
        return Response(graph)


class GraphSearchView(APIView):
    def get(self, request):
        query = request.query_params.get("q", "").strip()
        if not query:
            return Response({"results": []})
        service = GraphService()
        results = service.search(query, request.user.id)
        return Response({"results": results})
