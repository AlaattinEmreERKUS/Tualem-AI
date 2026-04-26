from .repositories import ConversationRepository
from .models import Conversation


class ChatService:
    def __init__(self):
        self.repo = ConversationRepository()

    def start_conversation(self, user_id: int) -> Conversation:
        pass

    def send_message(self, conv_id: int, user_id: int, user_message: str) -> str:
        """RAG pipeline: retrieve context from graph → build prompt → call Gemini."""
        pass

    def _retrieve_context(self, query: str, user_id: int) -> str:
        """Query graph-service for relevant nodes."""
        pass

    def _call_gemini(self, prompt: str) -> str:
        pass
