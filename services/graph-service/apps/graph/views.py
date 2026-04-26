from rest_framework.views import APIView
from rest_framework.response import Response
from .services import GraphService


class IngestConceptsView(APIView):
    def post(self, request):
        pass


class UserGraphView(APIView):
    def get(self, request):
        pass


class GraphSearchView(APIView):
    def get(self, request):
        pass
