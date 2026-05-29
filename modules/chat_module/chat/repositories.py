from .models import ChatRoom, ChatMessage

class ChatRepository:
    
    @staticmethod
    def get_rooms_by_user(user_id):
        return ChatRoom.objects.filter(user_id=user_id).order_by('-created_at')

    @staticmethod
    def get_room_by_id(room_id):
        try:
            return ChatRoom.objects.get(id=room_id)
        except ChatRoom.DoesNotExist:
            return None

    @staticmethod
    def get_messages_by_room(room_id):
        return ChatMessage.objects.filter(room_id=room_id).order_by('created_at')

    @staticmethod
    def create_room(title, user_id):
        return ChatRoom.objects.create(title=title, user_id=user_id)

    @staticmethod
    def create_message(room_obj, role, content, sources=None):
        return ChatMessage.objects.create(
            room=room_obj,
            role=role,
            content=content,
            sources=sources or {}
        )

    @staticmethod
    def delete_room(room_id, user_id) -> bool:
        deleted, _ = ChatRoom.objects.filter(id=room_id, user_id=user_id).delete()
        return deleted > 0