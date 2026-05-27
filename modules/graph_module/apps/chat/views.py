from rest_framework import viewsets, status
from rest_framework.response import Response
from .models import ChatRoom, ChatMessage
from apps.serializers.chat_serializers import ChatRoomSerializer, ChatMessageSerializer

class ChatRoomViewSet(viewsets.ModelViewSet):
    serializer_class = ChatRoomSerializer

    def get_user_id(self, request):

        user_id = request.META.get('HTTP_X_USER_ID')
        if not user_id:
            return 1
        return int(user_id)

    def get_queryset(self):
        
        user_id = self.get_user_id(self.request)
        return ChatRoom.objects.filter(user_id=user_id)

    def perform_create(self, serializer):
       
        user_id = self.get_user_id(self.request)
        serializer.save(user_id=user_id)


class ChatMessageViewSet(viewsets.ReadOnlyModelViewSet):

    serializer_class = ChatMessageSerializer

    def get_queryset(self):
        room_id = self.kwargs.get('room_pk')
        return ChatMessage.objects.filter(room_id=room_id)