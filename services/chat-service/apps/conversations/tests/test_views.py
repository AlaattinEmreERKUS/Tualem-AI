from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from apps.conversations.models import Conversation, Message
from apps.conversations.authentication import UserProxy


class ConversationViewTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = UserProxy(user_id=42)
        self.client.force_authenticate(user=self.user)

    def test_create_conversation(self):
        response = self.client.post(reverse("conversation-list-create"))
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Conversation.objects.filter(user_id=42).count(), 1)

    def test_list_conversations(self):
        Conversation.objects.create(user_id=42, title="A")
        Conversation.objects.create(user_id=42, title="B")
        Conversation.objects.create(user_id=99, title="Other user")
        response = self.client.get(reverse("conversation-list-create"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)

    def test_get_conversation_detail(self):
        conv = Conversation.objects.create(user_id=42, title="Mine")
        response = self.client.get(reverse("conversation-detail", args=[conv.id]))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["title"], "Mine")

    def test_get_conversation_wrong_user_returns_404(self):
        conv = Conversation.objects.create(user_id=99, title="Not mine")
        response = self.client.get(reverse("conversation-detail", args=[conv.id]))
        self.assertEqual(response.status_code, 404)

    def test_delete_conversation(self):
        conv = Conversation.objects.create(user_id=42)
        response = self.client.delete(reverse("conversation-detail", args=[conv.id]))
        self.assertEqual(response.status_code, 204)
        self.assertEqual(Conversation.objects.count(), 0)


class ChatViewTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = UserProxy(user_id=42)
        self.client.force_authenticate(user=self.user)
        self.conv = Conversation.objects.create(user_id=42)

    @patch("apps.conversations.services.GraphClient")
    @patch("apps.conversations.services.genai")
    def test_send_message(self, mock_genai, mock_graph_client):
        mock_graph_client.return_value.search_concepts.return_value = []
        mock_model = MagicMock()
        mock_model.generate_content.return_value.text = "Hello!"
        mock_genai.GenerativeModel.return_value = mock_model

        response = self.client.post(
            reverse("chat", args=[self.conv.id]),
            {"message": "What is machine learning?"},
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["role"], Message.Role.ASSISTANT)
        self.assertEqual(response.data["content"], "Hello!")
        self.assertEqual(self.conv.messages.count(), 2)

    def test_send_message_wrong_conversation_returns_400(self):
        other_conv = Conversation.objects.create(user_id=99)
        response = self.client.post(
            reverse("chat", args=[other_conv.id]),
            {"message": "Hi"},
        )
        self.assertIn(response.status_code, [400, 403, 404])
