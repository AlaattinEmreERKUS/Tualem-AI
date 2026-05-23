from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from apps.service.graph_service import GraphService
from apps.serializers.graph_serializers import (
    DocumentSerializer,
    DocumentUploadSerializer,
    ContentChunkSerializer,
    GraphTaskSerializer,
)
from apps.exceptions.graph_exceptions import (
    GraphBaseException,
    DocumentNotFoundException,
    DocumentAccessDeniedException,
)
from apps.utils.jwt_utils import verify_token, AuthenticationException


def get_user_id(request):
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None, AuthenticationException("Token bulunamadı.")
    token = auth_header.split(" ", 1)[1]
    try:
        payload = verify_token(token)
        return payload["user_id"], None
    except AuthenticationException as e:
        return None, e


class DocumentListView(APIView):

    def get(self, request):
        user_id, err = get_user_id(request)
        if err:
            return Response({"error": err.message}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            documents = GraphService.get_documents(user_id)
            return Response(DocumentSerializer(documents, many=True).data)
        except GraphBaseException as e:
            return Response({"error": e.message}, status=status.HTTP_400_BAD_REQUEST)

    def post(self, request):
        user_id, err = get_user_id(request)
        if err:
            return Response({"error": err.message}, status=status.HTTP_401_UNAUTHORIZED)

        serializer = DocumentUploadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        file = serializer.validated_data['file']
        try:
            result = GraphService.upload_document(
                user_id=user_id,
                file_name=file.name,
                file_type=file.content_type,
                file=file,
            )
            return Response(result, status=status.HTTP_201_CREATED)
        except GraphBaseException as e:
            return Response({"error": e.message}, status=status.HTTP_400_BAD_REQUEST)


class DocumentDetailView(APIView):

    def get(self, request, document_id):
        user_id, err = get_user_id(request)
        if err:
            return Response({"error": err.message}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            document = GraphService.get_document(document_id, user_id)
            return Response(DocumentSerializer(document).data)
        except DocumentNotFoundException as e:
            return Response({"error": e.message}, status=status.HTTP_404_NOT_FOUND)
        except GraphBaseException as e:
            return Response({"error": e.message}, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, document_id):
        user_id, err = get_user_id(request)
        if err:
            return Response({"error": err.message}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            GraphService.delete_document(document_id, user_id)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except DocumentAccessDeniedException as e:
            return Response({"error": e.message}, status=status.HTTP_403_FORBIDDEN)
        except GraphBaseException as e:
            return Response({"error": e.message}, status=status.HTTP_400_BAD_REQUEST)


class DocumentTaskStatusView(APIView):

    def get(self, request, document_id):
        user_id, err = get_user_id(request)
        if err:
            return Response({"error": err.message}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            GraphService.get_document(document_id, user_id)
            task = GraphService.get_task_status(document_id)
            return Response(GraphTaskSerializer(task).data)
        except DocumentNotFoundException as e:
            return Response({"error": e.message}, status=status.HTTP_404_NOT_FOUND)
        except GraphBaseException as e:
            return Response({"error": e.message}, status=status.HTTP_400_BAD_REQUEST)


class DocumentChunkListView(APIView):

    def get(self, request, document_id):
        user_id, err = get_user_id(request)
        if err:
            return Response({"error": err.message}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            chunks = GraphService.get_chunks(document_id, user_id)
            return Response(ContentChunkSerializer(chunks, many=True).data)
        except DocumentNotFoundException as e:
            return Response({"error": e.message}, status=status.HTTP_404_NOT_FOUND)
        except GraphBaseException as e:
            return Response({"error": e.message}, status=status.HTTP_400_BAD_REQUEST)
