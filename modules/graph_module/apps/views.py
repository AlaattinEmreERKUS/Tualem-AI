import json
import logging
from django.http import StreamingHttpResponse
from rest_framework.views import APIView

logger = logging.getLogger('graph_module')
from rest_framework.response import Response
from rest_framework import status

from rest_framework.throttling import UserRateThrottle
from apps.service.graph_service import GraphService
from apps.service.graph_rag_service import GraphRAGService
from apps.utils.room_access import user_can_access_room
from apps.utils.throttles import QueryThrottle, UploadThrottle, LiteratureThrottle
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
    throttle_classes_by_method = {'post': [UploadThrottle]}

    def get_throttles(self):
        if self.request.method == 'POST':
            return [UploadThrottle()]
        return []

    def get(self, request):
        try:
            room_id = request.query_params.get("room_id") or None
            documents = GraphService.get_documents(request.user.id, room_id=room_id)
            return Response(DocumentSerializer(documents, many=True).data)
        except GraphBaseException as e:
            return Response({"error": e.message}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.exception("get_documents unexpected error | %s", e)
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request):
        serializer = DocumentUploadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        file = serializer.validated_data['file']
        room_id = request.data.get('room_id') or None
        if room_id and not user_can_access_room(request.user.id, room_id, request.auth):
            return Response({"error": "Bu odaya erişim yetkiniz yok."}, status=status.HTTP_403_FORBIDDEN)
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
        except Exception as e:
            logger.exception("upload_document unexpected error | %s", e)
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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
        except Exception as e:
            logger.exception("delete_document unexpected error | doc=%s | %s", document_id, e)
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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
        except Exception as e:
            logger.exception("get_task_status unexpected error | doc=%s | %s", document_id, e)
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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
    throttle_classes = [LiteratureThrottle]

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
    throttle_classes = [QueryThrottle]

    def post(self, request):
        serializer = QueryRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        room_id = data.get("room_id") or None
        if room_id and not user_can_access_room(request.user.id, room_id, request.auth):
            return Response({"error": "Bu odaya erişim yetkiniz yok."}, status=status.HTTP_403_FORBIDDEN)

        if data.get("stream") and not data.get("action"):
            def _stream_gen():
                for line in GraphRAGService.stream_query(
                    user_id=str(request.user.id),
                    question=data["question"],
                    top_k=data["top_k"],
                    provider=data.get("provider", ""),
                    model=data.get("model", ""),
                    room_id=room_id,
                    excluded_doc_ids=data.get("excluded_doc_ids") or [],
                    history=data.get("history") or [],
                ):
                    yield line + "\n"
            return StreamingHttpResponse(_stream_gen(), content_type="application/x-ndjson")

        try:
            result = GraphRAGService.query(
                user_id=str(request.user.id),
                question=data["question"],
                top_k=data["top_k"],
                provider=data.get("provider", ""),
                model=data.get("model", ""),
                action=data.get("action", ""),
                room_id=room_id,
                excluded_doc_ids=data.get("excluded_doc_ids") or [],
                history=data.get("history") or [],
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
