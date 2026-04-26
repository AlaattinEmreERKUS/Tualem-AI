from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response

from .serializers import (
    ChatRequestSerializer,
    ConversationListSerializer,
    ConversationSerializer,
    MessageSerializer,
)
from .services import ChatService


class ConversationListCreateView(APIView):
    def get(self, request):
        service = ChatService()
        conversations = service.list_conversations(request.user.id)
        serializer = ConversationListSerializer(conversations, many=True)
        return Response(serializer.data)

    def post(self, request):
        service = ChatService()
        conversation = service.start_conversation(request.user.id)
        serializer = ConversationSerializer(conversation)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ConversationDetailView(APIView):
    def get(self, request, conv_id):
        service = ChatService()
        conversation = service.get_conversation(conv_id, request.user.id)
        if not conversation:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = ConversationSerializer(conversation)
        return Response(serializer.data)

    def delete(self, request, conv_id):
        service = ChatService()
        deleted = service.delete_conversation(conv_id, request.user.id)
        if not deleted:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ChatView(APIView):
    def post(self, request, conv_id):
        serializer = ChatRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        service = ChatService()
        try:
            message = service.send_message(
                conv_id,
                request.user.id,
                serializer.validated_data["message"],
                token=str(request.auth),
            )
        except ValueError:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(MessageSerializer(message).data, status=status.HTTP_201_CREATED)
