import json
import logging
import httpx
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.conf import settings

logger = logging.getLogger(__name__)
from shared.jwt_utils import decode_token, TokenExpiredError, InvalidTokenError
from shared.token_blacklist import is_blacklisted
from .models import ChatRoom, ChatMessage

GRAPH_MODULE_URL = "http://graph_module:8002"
_GRAPH_HEADERS_BASE = {"Host": "localhost"}

_USER_FRIENDLY_ERRORS = {
    404: "Kaynaklarınızda bu konuyla ilgili bilgi bulunamadı.",
    400: "Geçersiz istek. Sorunuzu kontrol edin.",
    403: "Bu kaynağa erişim yetkiniz yok.",
    429: "Model şu an meşgul. Lütfen bekleyin veya başka bir model seçin.",
    503: "Model şu an meşgul. Lütfen bekleyin veya başka bir model seçin.",
    500: "Bir hata oluştu. Lütfen tekrar deneyin.",
}


def _friendly_error(status_code: int, raw_msg: str) -> str:
    return _USER_FRIENDLY_ERRORS.get(status_code, f"Beklenmeyen hata ({status_code}).")


class ResearchChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.room_group_name = f'chat_research_{self.room_id}'
        self.authenticated = False
        self.user_id = None
        self.token = None
        await self.accept()

    async def disconnect(self, close_code):
        if self.authenticated:
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        if not self.authenticated:
            await self._handle_auth(text_data)
            return

        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return

        msg_type = data.get('type', 'message')
        if msg_type == 'search_topic':
            await self.handle_literature_search(data)
        else:
            await self.handle_chat_message(data)

    async def _handle_auth(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            await self.close(code=4002)
            return

        if data.get('type') != 'auth':
            await self.close(code=4003)
            return

        token = data.get('token', '')
        try:
            payload = decode_token(token, settings.JWT_SECRET)
        except (TokenExpiredError, InvalidTokenError):
            await self.close(code=4001)
            return

        if payload.get('type') != 'access':
            await self.close(code=4001)
            return

        jti = payload.get('jti')
        if jti and is_blacklisted(jti):
            await self.close(code=4001)
            return

        self.user_id = payload.get('user_id')
        self.token = token
        self.authenticated = True

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.send(text_data=json.dumps({'type': 'auth_ok'}))

    async def handle_chat_message(self, data):
        user_message = data.get('message')
        model = data.get('model', '')
        provider = data.get('provider', '')
        action = data.get('action', '')
        excluded_doc_ids = data.get('excluded_doc_ids', [])
        if not user_message:
            return

        await self.save_message(room_id=self.room_id, role='user', content=user_message)
        await self.channel_layer.group_send(
            self.room_group_name,
            {'type': 'chat_message', 'role': 'user', 'message': user_message}
        )
        await self.process_rag_and_llm(user_message, model, provider, action, excluded_doc_ids)

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
            async with httpx.AsyncClient(timeout=600.0) as client:
                response = await client.post(
                    f"{GRAPH_MODULE_URL}/api/documents/search/",
                    json={"topic": topic, "max_results": max_results},
                    headers={**_GRAPH_HEADERS_BASE, "Authorization": f"Bearer {self.token}"},
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

    async def process_rag_and_llm(self, user_message, model="", provider="", action="", excluded_doc_ids=None):
        await self.channel_layer.group_send(
            self.room_group_name,
            {'type': 'chat_message', 'role': 'system', 'message': 'Grafik veritabanında araştırma yapılıyor...'}
        )

        try:
            async with httpx.AsyncClient(timeout=600.0) as client:
                response = await client.post(
                    f"{GRAPH_MODULE_URL}/api/query/",
                    json={
                        "question": user_message,
                        "top_k": 5,
                        "model": model,
                        "provider": provider,
                        "action": action,
                        "room_id": str(self.room_id),
                        "excluded_doc_ids": excluded_doc_ids or [],
                    },
                    headers={**_GRAPH_HEADERS_BASE, "Authorization": f"Bearer {self.token}"},
                )

            logger.info("RAG query | status=%s | model=%s", response.status_code, model)

            if response.status_code != 200:
                try:
                    err_body = response.json()
                    raw_msg = err_body.get('error', str(err_body))
                except Exception:
                    raw_msg = f'HTTP {response.status_code}'
                logger.warning("RAG query error | status=%s | detail=%s", response.status_code, raw_msg)
                user_msg = _friendly_error(response.status_code, raw_msg)
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'chat_message',
                        'role': 'assistant',
                        'message': f'⚠️ {user_msg}',
                        'is_streaming': False,
                        'sources': {},
                    }
                )
                return

            result = response.json()
            answer = result.get("answer", "")
            provider = result.get("provider", "")
            sources = result.get("sources", [])
            action_type = result.get("action_type", "")

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'role': 'assistant',
                    'message': answer,
                    'is_streaming': False,
                    'sources': {'results': sources, 'provider': provider},
                    'action_type': action_type,
                }
            )

            await self.save_message(
                room_id=self.room_id,
                role='assistant',
                content=answer,
                sources={'results': sources, 'provider': provider},
            )

        except httpx.TimeoutException as exc:
            logger.error("Graph module timeout: %s", exc)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'role': 'assistant',
                    'message': '⚠️ İstek zaman aşımına uğradı (120s). Model yavaş yanıt veriyor olabilir.',
                    'is_streaming': False,
                    'sources': {},
                }
            )
        except httpx.RequestError as exc:
            logger.error("Graph module request error: %s: %s", type(exc).__name__, exc)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'role': 'assistant',
                    'message': f'⚠️ Graf servisine ulaşılamıyor ({type(exc).__name__}).',
                    'is_streaming': False,
                    'sources': {},
                }
            )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'role': event.get('role'),
            'message': event.get('message'),
            'is_streaming': event.get('is_streaming', False),
            'sources': event.get('sources', {}),
            'action_type': event.get('action_type', ''),
        }))

    @database_sync_to_async
    def save_message(self, room_id, role, content, sources=None):
        room = ChatRoom.objects.get(id=room_id)
        return ChatMessage.objects.create(room=room, role=role, content=content, sources=sources or {})
