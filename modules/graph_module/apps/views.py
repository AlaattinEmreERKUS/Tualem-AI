import logging
from rest_framework.views import APIView

logger = logging.getLogger('graph_module')
from rest_framework.response import Response
from rest_framework import status

from apps.service.graph_service import GraphService
from apps.service.graph_rag_service import GraphRAGService
from apps.serializers.graph_serializers import (
    DocumentSerializer,
    DocumentUploadSerializer,
    ContentChunkSerializer,
    GraphTaskSerializer,
    QueryRequestSerializer,
    QueryResponseSerializer,
    LiteratureSearchRequestSerializer,
    LiteratureSearchResultSerializer,
)
from apps.exceptions.graph_exceptions import (
    GraphBaseException,
    DocumentNotFoundException,
    DocumentAccessDeniedException,
    NoRelevantChunksException,
    RAGQueryException,
    LiteratureSearchException,
)


class DocumentListView(APIView):

    def get(self, request):
        try:
            documents = GraphService.get_documents(request.user.id)
            return Response(DocumentSerializer(documents, many=True).data)
        except GraphBaseException as e:
            return Response({"error": e.message}, status=status.HTTP_400_BAD_REQUEST)

    def post(self, request):
        serializer = DocumentUploadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        file = serializer.validated_data['file']
        room_id = request.data.get('room_id') or None
        try:
            result = GraphService.upload_document(
                user_id=request.user.id,
                file_name=file.name,
                file_type=file.content_type,
                file=file,
                room_id=room_id,
            )
            return Response(result, status=status.HTTP_201_CREATED)
        except GraphBaseException as e:
            return Response({"error": e.message}, status=status.HTTP_400_BAD_REQUEST)


class DocumentDetailView(APIView):

    def get(self, request, document_id):
        try:
            document = GraphService.get_document(document_id, request.user.id)
            return Response(DocumentSerializer(document).data)
        except DocumentNotFoundException as e:
            return Response({"error": e.message}, status=status.HTTP_404_NOT_FOUND)
        except GraphBaseException as e:
            return Response({"error": e.message}, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, document_id):
        try:
            GraphService.delete_document(document_id, request.user.id)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except DocumentAccessDeniedException as e:
            return Response({"error": e.message}, status=status.HTTP_403_FORBIDDEN)
        except GraphBaseException as e:
            return Response({"error": e.message}, status=status.HTTP_400_BAD_REQUEST)


class DocumentTaskStatusView(APIView):

    def get(self, request, document_id):
        try:
            GraphService.get_document(document_id, request.user.id)
            task = GraphService.get_task_status(document_id)
            return Response(GraphTaskSerializer(task).data)
        except DocumentNotFoundException as e:
            return Response({"error": e.message}, status=status.HTTP_404_NOT_FOUND)
        except GraphBaseException as e:
            return Response({"error": e.message}, status=status.HTTP_400_BAD_REQUEST)


class DocumentChunkListView(APIView):

    def get(self, request, document_id):
        try:
            chunks = GraphService.get_chunks(document_id, request.user.id)
            return Response(ContentChunkSerializer(chunks, many=True).data)
        except DocumentNotFoundException as e:
            return Response({"error": e.message}, status=status.HTTP_404_NOT_FOUND)
        except GraphBaseException as e:
            return Response({"error": e.message}, status=status.HTTP_400_BAD_REQUEST)


class LiteratureSearchView(APIView):

    def post(self, request):
        serializer = LiteratureSearchRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        try:
            from apps.service.literature_search_service import LiteratureSearchService
            results = LiteratureSearchService.search_and_import(
                user_id=str(request.user.id),
                topic=data["topic"],
                max_results=data["max_results"],
            )
            return Response(
                LiteratureSearchResultSerializer(results, many=True).data,
                status=status.HTTP_201_CREATED,
            )
        except LiteratureSearchException as e:
            return Response({"error": e.message}, status=status.HTTP_404_NOT_FOUND)
        except GraphBaseException as e:
            return Response({"error": e.message}, status=status.HTTP_400_BAD_REQUEST)


class QueryView(APIView):

    def post(self, request):
        serializer = QueryRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        try:
            result = GraphRAGService.query(
                user_id=str(request.user.id),
                question=data["question"],
                top_k=data["top_k"],
                provider=data.get("provider", ""),
                model=data.get("model", ""),
                action=data.get("action", ""),
                room_id=data.get("room_id") or None,
            )
            return Response(QueryResponseSerializer(result).data)
        except NoRelevantChunksException as e:
            return Response({"error": e.message}, status=status.HTTP_404_NOT_FOUND)
        except RAGQueryException as e:
            logger.error("RAG query failed: %s", e.message)
            code = status.HTTP_503_SERVICE_UNAVAILABLE if "rate limit" in e.message.lower() else status.HTTP_500_INTERNAL_SERVER_ERROR
            return Response({"error": e.message}, status=code)
        except GraphBaseException as e:
            return Response({"error": e.message}, status=status.HTTP_400_BAD_REQUEST)
