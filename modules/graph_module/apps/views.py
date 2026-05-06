from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.permissions import IsAuthenticated
from apps.service.graph_service import GraphService


class DocumentListView(generics.GenericAPIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        docs = GraphService.get_document_list()
        return Response(data=docs or [])

    def post(self, request):
        file_name = request.data.get("file_name")
        file_type = request.data.get("file_type")
        file = request.FILES.get("file")

        if not all([file_name, file_type, file]):
            return Response(
                {"error": "file_name, file_type, file zorunlu."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        doc = GraphService.create_document(file_name, file_type, file)
        return Response(data=doc, status=status.HTTP_201_CREATED)


class DocumentDetailView(generics.GenericAPIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request, document_id):
        doc = GraphService.get_document_by_id(document_id)
        if doc is None:
            return Response(
                {"error": "Döküman bulunamadı."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(data=doc)

    def put(self, request, document_id):
        file_name = request.data.get("file_name")
        file_type = request.data.get("file_type")
        file = request.FILES.get("file")

        doc = GraphService.update_document(document_id, file_name, file_type, file)
        if doc is None:
            return Response(
                {"error": "Döküman bulunamadı."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(data=doc)

    def delete(self, request, document_id):
        GraphService.delete_document(document_id)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ContentChunkListView(generics.GenericAPIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, document_id):
        chunks = GraphService.get_contentchunk_list(document_id)
        return Response(data=chunks or [])


class ContentChunkDetailView(generics.GenericAPIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, document_id, contentchunk_id):
        chunk = GraphService.get_contentchunk_by_id(document_id, contentchunk_id)
        if chunk is None:
            return Response(
                {"error": "ContentChunk bulunamadı."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(data=chunk)
