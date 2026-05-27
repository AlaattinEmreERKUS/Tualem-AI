from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .repositories import ChatRepository
from .chat_serializers import ChatRoomSerializer, ChatMessageSerializer

class ChatRoomViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        rooms = ChatRepository.get_all_rooms()
        serializer = ChatRoomSerializer(rooms, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def create(self, request):
        name = request.data.get('name')
        if not name:
            return Response({"error": "Oda ismi (name) alanı zorunludur."}, status=status.HTTP_400_BAD_REQUEST)
        
        room = ChatRepository.create_room(name=name, user=request.user)
        serializer = ChatRoomSerializer(room)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ChatMessageViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request, room_pk=None):
        room = ChatRepository.get_room_by_id(room_pk)
        if not room:
            return Response({"error": "İstenen sohbet odası bulunamadı."}, status=status.HTTP_404_NOT_FOUND)
        
        messages = ChatRepository.get_messages_by_room(room_id=room_pk)
        serializer = ChatMessageSerializer(messages, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)