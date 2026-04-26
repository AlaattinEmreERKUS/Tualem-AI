from rest_framework import serializers
from .models import Conversation, Message


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ["id", "role", "content", "created_at"]
        read_only_fields = ["id", "created_at"]


class ConversationListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Conversation
        fields = ["id", "title", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class ConversationSerializer(serializers.ModelSerializer):
    messages = MessageSerializer(many=True, read_only=True)

    class Meta:
        model = Conversation
        fields = ["id", "title", "messages", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class ChatRequestSerializer(serializers.Serializer):
    message = serializers.CharField()
