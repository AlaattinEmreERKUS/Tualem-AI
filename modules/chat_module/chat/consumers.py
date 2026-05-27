import json
import asyncio
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import ChatRoom, ChatMessage

class ResearchChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.room_group_name = f'chat_research_{self.room_id}'
        
        self.user_id = self.scope.get("user_id")
        if not self.user_id:
            await self.close(code=4001)
            return

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        user_message = data.get('message')

        if not user_message:
            return

        await self.save_message(room_id=self.room_id, role='user', content=user_message)

        await self.channel_layer.group_send(
            self.room_group_name,
            {'type': 'chat_message', 'role': 'user', 'message': user_message}
        )

        await self.process_rag_and_llm(user_message)

    async def process_rag_and_llm(self, user_message):
        """
        Projenin service katmanıyla konuşacak ana AI pipeline'ı.
        """

        mock_retrieved_docs = ["graph_database_insider.pdf", "academic_paper_2026.txt"]
        
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message', 
                'role': 'system', 
                'message': f"Grafik veritabanında araştırma yapılıyor... Kaynaklar tarandı: {', '.join(mock_retrieved_docs)}"
            }
        )
        await asyncio.sleep(1)

        full_response = ""
        ai_chunks = ["Analiz", " tamamlandı.", " Belirtilen", " dökümanlara", " göre", " araştırma", " ekosisteminizdeki", " düğümler", " (nodes)", " bağlandı."]
        
        for chunk in ai_chunks:
            full_response += chunk + " "
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'role': 'assistant',
                    'message': chunk + " ",
                    'is_streaming': True
                }
            )
            await asyncio.sleep(0.2)

        await self.save_message(
            room_id=self.room_id, 
            role='assistant', 
            content=full_response.strip(),
            sources={"retrieved_files": mock_retrieved_docs}
        )

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'role': 'assistant',
                'message': '',
                'is_streaming': False,
                'sources': {"retrieved_files": mock_retrieved_docs}
            }
        )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'role': event.get('role'),
            'message': event.get('message'),
            'is_streaming': event.get('is_streaming', False),
            'sources': event.get('sources', {})
        }))

    @database_sync_to_async
    def save_message(self, room_id, role, content, sources=None):
        room = ChatRoom.objects.get(id=room_id)
        return ChatMessage.objects.create(room=room, role=role, content=content, sources=sources or {})