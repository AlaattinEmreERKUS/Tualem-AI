from .models import Conversation, Message


class ConversationRepository:
    def create(self, user_id: int, title: str = "") -> Conversation:
        return Conversation.objects.create(user_id=user_id, title=title)

    def get_by_id(self, conv_id: int) -> Conversation | None:
        return Conversation.objects.filter(id=conv_id).first()

    def get_by_user(self, user_id: int):
        return Conversation.objects.filter(user_id=user_id)

    def delete(self, conversation: Conversation) -> None:
        conversation.delete()

    def add_message(self, conversation: Conversation, role: str, content: str) -> Message:
        return Message.objects.create(conversation=conversation, role=role, content=content)

    def get_recent_messages(self, conv_id: int, limit: int = 10) -> list[Message]:
        return list(
            Message.objects.filter(conversation_id=conv_id).order_by("-created_at")[:limit]
        )
