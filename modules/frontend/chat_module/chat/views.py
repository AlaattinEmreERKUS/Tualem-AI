import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .repositories import ChatRepository
from .chat_serializers import ChatRoomSerializer, ChatMessageSerializer

logger = logging.getLogger("chat_module")


class ChatRoomViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        logger.info("[rooms] list | user=%s", request.user.id)
        try:
            rooms = ChatRepository.get_rooms_by_user(user_id=request.user.id)
            serializer = ChatRoomSerializer(rooms, many=True)
            logger.info("[rooms] list ok | count=%d", len(serializer.data))
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception("[rooms] list error | %s", e)
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def create(self, request):
        name = request.data.get('title') or request.data.get('name')
        logger.info("[rooms] create | user=%s title=%r", request.user.id, name)
        if not name:
            return Response({"error": "Oda ismi (title) alanı zorunludur."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            room = ChatRepository.create_room(title=name, user_id=request.user.id)
            serializer = ChatRoomSerializer(room)
            logger.info("[rooms] create ok | room=%s", room.id)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.exception("[rooms] create error | %s", e)
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def partial_update(self, request, pk=None):
        try:
            pk_int = int(pk)
        except (TypeError, ValueError):
            return Response({"error": "Geçersiz oda ID."}, status=status.HTTP_400_BAD_REQUEST)
        title = (request.data.get("title") or "").strip()
        logger.info("[rooms] patch | user=%s room=%s title=%r", request.user.id, pk_int, title)
        if not title:
            return Response({"error": "Başlık boş olamaz."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            updated = ChatRepository.update_room_title(room_id=pk_int, user_id=request.user.id, title=title)
            if not updated:
                logger.warning("[rooms] patch not found | room=%s user=%s", pk_int, request.user.id)
                return Response({"error": "Oda bulunamadı veya erişim yetkiniz yok."}, status=status.HTTP_404_NOT_FOUND)
            room = ChatRepository.get_room_by_id(pk_int)
            return Response(ChatRoomSerializer(room).data)
        except Exception as e:
            logger.exception("[rooms] patch error | %s", e)
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def destroy(self, request, pk=None):
        try:
            pk_int = int(pk)
        except (TypeError, ValueError):
            return Response({"error": "Geçersiz oda ID."}, status=status.HTTP_400_BAD_REQUEST)
        logger.info("[rooms] delete | user=%s room=%s", request.user.id, pk_int)
        try:
            deleted = ChatRepository.delete_room(room_id=pk_int, user_id=request.user.id)
            if not deleted:
                logger.warning("[rooms] delete not found | room=%s user=%s", pk_int, request.user.id)
                return Response({"error": "Oda bulunamadı veya erişim yetkiniz yok."}, status=status.HTTP_404_NOT_FOUND)
            logger.info("[rooms] delete ok | room=%s", pk_int)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            logger.exception("[rooms] delete error | %s", e)
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


    @action(detail=True, methods=['get'])
    def access(self, request, pk=None):
        allowed = ChatRepository.user_can_access_room(pk, request.user.id)
        if allowed:
            return Response({"allowed": True}, status=status.HTTP_200_OK)
        logger.warning("[rooms] access denied | room=%s user=%s", pk, request.user.id)
        return Response({"allowed": False}, status=status.HTTP_403_FORBIDDEN)


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