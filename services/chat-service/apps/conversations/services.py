import google.generativeai as genai
from django.conf import settings

from .graph_client import GraphClient
from .models import Conversation, Message
from .repositories import ConversationRepository


class ChatService:
    def __init__(self):
        self.repo = ConversationRepository()

    def start_conversation(self, user_id: int, title: str = "") -> Conversation:
        return self.repo.create(user_id=user_id, title=title)

    def list_conversations(self, user_id: int):
        return self.repo.get_by_user(user_id)

    def get_conversation(self, conv_id: int, user_id: int) -> Conversation | None:
        conversation = self.repo.get_by_id(conv_id)
        if conversation and conversation.user_id != user_id:
            return None
        return conversation

    def delete_conversation(self, conv_id: int, user_id: int) -> bool:
        conversation = self.repo.get_by_id(conv_id)
        if not conversation or conversation.user_id != user_id:
            return False
        self.repo.delete(conversation)
        return True

    def send_message(self, conv_id: int, user_id: int, content: str, token: str) -> Message:
        conversation = self.repo.get_by_id(conv_id)
        if not conversation or conversation.user_id != user_id:
            raise ValueError("Conversation not found")

        self.repo.add_message(conversation, Message.Role.USER, content)
        context = self._retrieve_context(content, token)
        history = self.repo.get_recent_messages(conv_id, limit=10)
        prompt = self._build_prompt(content, context, history)
        response_text = self._call_gemini(prompt)
        return self.repo.add_message(conversation, Message.Role.ASSISTANT, response_text)

    def _retrieve_context(self, query: str, token: str) -> str:
        try:
            results = GraphClient(token).search_concepts(query)
        except Exception:
            return ""
        if not results:
            return ""
        parts = []
        for concept in results[:5]:
            line = f"- {concept['name']}"
            if concept.get("description"):
                line += f": {concept['description']}"
            if concept.get("document"):
                line += f" (source: {concept['document']})"
            if concept.get("related_concepts"):
                line += f"\n  Related: {', '.join(concept['related_concepts'][:3])}"
            parts.append(line)
        return "\n".join(parts)

    def _build_prompt(self, message: str, context: str, history: list[Message]) -> str:
        history_text = "\n".join(
            f"{msg.role.capitalize()}: {msg.content}"
            for msg in reversed(history)
            if msg.role in (Message.Role.USER, Message.Role.ASSISTANT)
        )
        return (
            "You are a helpful AI assistant with access to the user's personal knowledge graph.\n"
            "Use the knowledge graph context below to ground your answers.\n"
            "If the context is not relevant, answer from general knowledge.\n\n"
            f"Knowledge Graph Context:\n{context or 'No relevant concepts found.'}\n\n"
            f"Conversation History:\n{history_text or 'No previous messages.'}\n\n"
            f"User: {message}\nAssistant:"
        )

    def _call_gemini(self, prompt: str) -> str:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content(prompt)
        return response.text
