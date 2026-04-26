from .models import Conversation, Message


class ConversationRepository:
    def create(self, user_id: int, title: str = "") -> Conversation:
        return Conversation.objects.create(user_id=user_id, title=title)

    def get_by_id(self, conv_id: int) -> Conversation | None:
        return Conversation.objects.filter(id=conv_id).first()

    def get_by_user(self, user_id: int):
        return Conversation.objects.filter(user_id=user_id)

    def add_message(self, conversation: Conversation, role: str, content: str) -> Message:
        return Message.objects.create(conversation=conversation, role=role, content=content)
