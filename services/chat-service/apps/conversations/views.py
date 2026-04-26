from rest_framework import generics
from rest_framework.views import APIView
from rest_framework.response import Response
from .services import ChatService
from .serializers import ConversationSerializer, ChatRequestSerializer


class ConversationListCreateView(generics.ListCreateAPIView):
    serializer_class = ConversationSerializer

    def get_queryset(self):
        pass

    def perform_create(self, serializer):
        pass


class ConversationDetailView(generics.RetrieveAPIView):
    serializer_class = ConversationSerializer

    def get_queryset(self):
        pass


class ChatView(APIView):
    def post(self, request, conv_id: int):
        pass
