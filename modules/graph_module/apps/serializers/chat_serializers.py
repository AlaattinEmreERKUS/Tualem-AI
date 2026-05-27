from rest_framework import serializers
# chat app'i altındaki modelleri import ediyoruz
from apps.chat.models import ChatRoom, ChatMessage

class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = ['id', 'role', 'content', 'sources', 'created_at']
        read_only_fields = ['id', 'created_at']


class ChatRoomSerializer(serializers.ModelSerializer):
    # Oda detayına bakıldığında içindeki son mesajları da görebilmek için:
    messages = ChatMessageSerializer(many=True, read_only=True)
    
    class Meta:
        model = ChatRoom
        fields = ['id', 'user_id', 'title', 'messages', 'created_at', 'updated_at']
        read_only_fields = ['id', 'user_id', 'created_at', 'updated_at']