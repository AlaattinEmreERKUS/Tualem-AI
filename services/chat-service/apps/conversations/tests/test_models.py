from django.test import TestCase
from apps.conversations.models import Conversation, Message


class ConversationModelTest(TestCase):
    def setUp(self):
        self.conversation = Conversation.objects.create(user_id=1, title="Test")

    def test_create_conversation(self):
        self.assertEqual(self.conversation.user_id, 1)
        self.assertEqual(self.conversation.title, "Test")

    def test_add_message(self):
        msg = Message.objects.create(
            conversation=self.conversation,
            role=Message.Role.USER,
            content="Hello",
        )
        self.assertEqual(msg.role, Message.Role.USER)
        self.assertEqual(msg.content, "Hello")
        self.assertEqual(self.conversation.messages.count(), 1)

    def test_message_ordering(self):
        Message.objects.create(conversation=self.conversation, role=Message.Role.USER, content="First")
        Message.objects.create(conversation=self.conversation, role=Message.Role.ASSISTANT, content="Second")
        messages = list(self.conversation.messages.all())
        self.assertEqual(messages[0].content, "First")
        self.assertEqual(messages[1].content, "Second")

    def test_cascade_delete(self):
        Message.objects.create(conversation=self.conversation, role=Message.Role.USER, content="Hi")
        self.conversation.delete()
        self.assertEqual(Message.objects.count(), 0)
