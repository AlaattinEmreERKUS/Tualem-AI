from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .repositories import ChatRepository
from .chat_serializers import ChatRoomSerializer, ChatMessageSerializer

class ChatRoomViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        rooms = ChatRepository.get_rooms_by_user(user_id=request.user.id)
        serializer = ChatRoomSerializer(rooms, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def create(self, request):
        name = request.data.get('title') or request.data.get('name')
        if not name:
            return Response({"error": "Oda ismi (title) alanı zorunludur."}, status=status.HTTP_400_BAD_REQUEST)

        room = ChatRepository.create_room(title=name, user_id=request.user.id)
        serializer = ChatRoomSerializer(room)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        try:
            pk_int = int(pk)
        except (TypeError, ValueError):
            return Response({"error": "Geçersiz oda ID."}, status=status.HTTP_400_BAD_REQUEST)
        title = (request.data.get("title") or "").strip()
        if not title:
            return Response({"error": "Başlık boş olamaz."}, status=status.HTTP_400_BAD_REQUEST)
        updated = ChatRepository.update_room_title(room_id=pk_int, user_id=request.user.id, title=title)
        if not updated:
            return Response({"error": "Oda bulunamadı veya erişim yetkiniz yok."}, status=status.HTTP_404_NOT_FOUND)
        room = ChatRepository.get_room_by_id(pk)
        return Response(ChatRoomSerializer(room).data)

    def destroy(self, request, pk=None):
        try:
            pk_int = int(pk)
        except (TypeError, ValueError):
            return Response({"error": "Geçersiz oda ID."}, status=status.HTTP_400_BAD_REQUEST)
        deleted = ChatRepository.delete_room(room_id=pk_int, user_id=request.user.id)
        if not deleted:
            return Response({"error": "Oda bulunamadı veya erişim yetkiniz yok."}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ChatMessageViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request, room_pk=None):
        room = ChatRepository.get_room_by_id(room_pk)
        if not room:
            return Response({"error": "İstenen sohbet odası bulunamadı."}, status=status.HTTP_404_NOT_FOUND)

        if str(room.user_id) != str(request.user.id):
            return Response({"error": "Bu odaya erişim yetkiniz yok."}, status=status.HTTP_403_FORBIDDEN)

        messages = ChatRepository.get_messages_by_room(room_id=room_pk)
        serializer = ChatMessageSerializer(messages, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)