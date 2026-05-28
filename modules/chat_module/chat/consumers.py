import json
import httpx
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import ChatRoom, ChatMessage

GRAPH_MODULE_URL = "http://graph_module:8002"


class ResearchChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.room_group_name = f'chat_research_{self.room_id}'

        self.user_id = self.scope.get("user_id")
        self.token = self.scope.get("token")

        if not self.user_id:
            await self.close(code=4001)
            return

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        msg_type = data.get('type', 'message')

        if msg_type == 'search_topic':
            await self.handle_literature_search(data)
        else:
            await self.handle_chat_message(data)

    async def handle_chat_message(self, data):
        user_message = data.get('message')

        if not user_message:
            return

        await self.save_message(room_id=self.room_id, role='user', content=user_message)

        await self.channel_layer.group_send(
            self.room_group_name,
            {'type': 'chat_message', 'role': 'user', 'message': user_message}
        )

        await self.process_rag_and_llm(user_message)

    async def handle_literature_search(self, data):
        topic = data.get('topic', '').strip()
        max_results = data.get('max_results', 5)

        if not topic:
            return

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'role': 'system',
                'message': f'"{topic}" konusu için arXiv\'de arama yapılıyor...',
            }
        )

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    f"{GRAPH_MODULE_URL}/api/documents/search/",
                    json={"topic": topic, "max_results": max_results},
                    headers={"Authorization": f"Bearer {self.token}"},
                )

            if response.status_code == 201:
                results = response.json()
                titles = "\n".join(f"• {r['title']}" for r in results)
                message = (
                    f"{len(results)} makale bulundu ve işleme alındı. "
                    f"Pipeline tamamlandığında soru sorabilirsiniz.\n\n{titles}"
                )
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {'type': 'chat_message', 'role': 'system', 'message': message}
                )
            else:
                error = response.json().get('error', 'Bilinmeyen hata.')
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {'type': 'chat_message', 'role': 'system', 'message': f'Arama başarısız: {error}'}
                )

        except httpx.RequestError:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'role': 'system',
                    'message': 'Graf servisine ulaşılamıyor. Lütfen daha sonra tekrar deneyin.',
                }
            )

    async def process_rag_and_llm(self, user_message):
        await self.channel_layer.group_send(
            self.room_group_name,
            {'type': 'chat_message', 'role': 'system', 'message': 'Grafik veritabanında araştırma yapılıyor...'}
        )

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{GRAPH_MODULE_URL}/api/query/",
                    json={"question": user_message, "top_k": 5},
                    headers={"Authorization": f"Bearer {self.token}"},
                )

            if response.status_code != 200:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'chat_message',
                        'role': 'assistant',
                        'message': 'Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.',
                        'is_streaming': False,
                        'sources': {},
                    }
                )
                return

            result = response.json()
            answer = result.get("answer", "")
            provider = result.get("provider", "")
            sources = result.get("sources", [])

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'role': 'assistant',
                    'message': answer,
                    'is_streaming': False,
                    'sources': {'results': sources, 'provider': provider},
                }
            )

            await self.save_message(
                room_id=self.room_id,
                role='assistant',
                content=answer,
                sources={'results': sources, 'provider': provider},
            )

        except httpx.RequestError:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'role': 'assistant',
                    'message': 'Graf servisine ulaşılamıyor. Lütfen daha sonra tekrar deneyin.',
                    'is_streaming': False,
                    'sources': {},
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
