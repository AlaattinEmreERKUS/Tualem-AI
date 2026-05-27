from .models import ChatRoom, ChatMessage

class ChatRepository:
    
    @staticmethod
    def get_all_rooms():
        return ChatRoom.objects.all().order_by('-created_at')

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
    def create_room(name, user):
        return ChatRoom.objects.create(name=name, user=user)

    @staticmethod
    def create_message(room_obj, role, content, sources=None):

        return ChatMessage.objects.create(
            room=room_obj,
            role=role,
            content=content,
            sources=sources or {}
        )