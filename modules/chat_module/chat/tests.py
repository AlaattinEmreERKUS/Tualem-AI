"""
chat_module test suite — gerçek senaryo akışları.

Mock edilenler (sadece bunlar):
  - Redis token blacklist: is_blacklisted

Geri kalan her şey gerçek: JWT üretimi/doğrulaması, PostgreSQL DB
  operasyonları, ChatRoom/ChatMessage kayıtları, kullanıcı izolasyonu.
"""

import json
from unittest import mock
from django.test import TestCase, TransactionTestCase, override_settings
from django.conf import settings
from rest_framework.test import APIClient

from chat.models import ChatRoom, ChatMessage


# ── JWT yardımcı ─────────────────────────────────────────────────────────────

def _make_token(user_id, username="testuser", email="test@chat.com"):
    from shared.jwt_utils import generate_access_token
    return generate_access_token(
        user_id=str(user_id),
        username=username,
        email=email,
        secret=settings.JWT_SECRET,
        lifetime_minutes=60,
    )


def _authed_client(user_id, email="test@chat.com"):
    client = APIClient()
    token = _make_token(user_id=user_id, email=email)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


ROOMS_URL = "/api/chat/rooms/"


def _room_url(pk):
    return f"/api/chat/rooms/{pk}/"


def _messages_url(room_pk):
    return f"/api/chat/rooms/{room_pk}/messages/"


# ── 1. Kimlik doğrulama zorunluluğu ──────────────────────────────────────────

class AuthRequiredTest(TestCase):
    def test_oda_listesi_token_olmadan_403(self):
        res = APIClient().get(ROOMS_URL)
        self.assertIn(res.status_code, [401, 403])

    def test_oda_olusturma_token_olmadan_403(self):
        res = APIClient().post(ROOMS_URL, {"title": "Oda"}, format="json")
        self.assertIn(res.status_code, [401, 403])

    def test_gecersiz_token_ile_403(self):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION="Bearer bu.gecersiz.token")
        res = client.get(ROOMS_URL)
        self.assertIn(res.status_code, [401, 403])


# ── 2. Tam oda yaşam döngüsü akışı ───────────────────────────────────────────

class ChatRoomLifecycleTest(TestCase):
    """
    Senaryo: Oda oluştur → listele → başlığı güncelle → sil → artık listede yok.
    """

    def setUp(self):
        self.client = _authed_client(user_id=1)
        self.bl = mock.patch("chat.authentication.is_blacklisted", return_value=False)
        self.bl.start()

    def tearDown(self):
        self.bl.stop()

    def test_tam_yasam_dongusu(self):
        # 1. Başlangıçta boş liste
        res = self.client.get(ROOMS_URL)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), [])

        # 2. Oda oluştur
        res = self.client.post(ROOMS_URL, {"title": "Makine Öğrenmesi"}, format="json")
        self.assertEqual(res.status_code, 201)
        room_id = res.json()["id"]
        self.assertEqual(res.json()["title"], "Makine Öğrenmesi")

        # 3. DB'de gerçekten var
        self.assertTrue(ChatRoom.objects.filter(id=room_id, user_id=1).exists())

        # 4. Listede görünüyor
        res = self.client.get(ROOMS_URL)
        self.assertEqual(len(res.json()), 1)

        # 5. Başlığı güncelle
        res = self.client.patch(_room_url(room_id), {"title": "Derin Öğrenme"}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(ChatRoom.objects.get(id=room_id).title, "Derin Öğrenme")

        # 6. Sil
        res = self.client.delete(_room_url(room_id))
        self.assertEqual(res.status_code, 204)

        # 7. DB'den gerçekten silindi
        self.assertFalse(ChatRoom.objects.filter(id=room_id).exists())

        # 8. Liste tekrar boş
        res = self.client.get(ROOMS_URL)
        self.assertEqual(res.json(), [])


# ── 3. Kullanıcı izolasyonu ───────────────────────────────────────────────────

class UserIsolationTest(TestCase):
    """
    Senaryo: Kullanıcı1 ve Kullanıcı2 aynı sistemde.
    Her biri sadece kendi odalarını görür, birbirinin odasını silemez,
    birbirinin mesajlarına erişemez.
    """

    def setUp(self):
        self.bl = mock.patch("chat.authentication.is_blacklisted", return_value=False)
        self.bl.start()
        self.client1 = _authed_client(user_id=1, email="user1@chat.com")
        self.client2 = _authed_client(user_id=2, email="user2@chat.com")

    def tearDown(self):
        self.bl.stop()

    def test_kullanici_sadece_kendi_odalarini_gorur(self):
        # user1: 2 oda
        self.client1.post(ROOMS_URL, {"title": "User1 Oda1"}, format="json")
        self.client1.post(ROOMS_URL, {"title": "User1 Oda2"}, format="json")
        # user2: 1 oda
        self.client2.post(ROOMS_URL, {"title": "User2 Oda1"}, format="json")

        res1 = self.client1.get(ROOMS_URL)
        res2 = self.client2.get(ROOMS_URL)

        self.assertEqual(len(res1.json()), 2)
        self.assertEqual(len(res2.json()), 1)

        # İsimler doğru
        basliklar1 = {r["title"] for r in res1.json()}
        self.assertIn("User1 Oda1", basliklar1)
        self.assertNotIn("User2 Oda1", basliklar1)

    def test_baska_kullanicinin_odasini_silemez(self):
        res = self.client1.post(ROOMS_URL, {"title": "User1 Odası"}, format="json")
        room_id = res.json()["id"]

        # user2 silmeye çalışır → 404
        res = self.client2.delete(_room_url(room_id))
        self.assertEqual(res.status_code, 404)

        # Oda hâlâ duruyor
        self.assertTrue(ChatRoom.objects.filter(id=room_id).exists())

    def test_baska_kullanicinin_basligini_guncelleyemez(self):
        res = self.client1.post(ROOMS_URL, {"title": "Orijinal"}, format="json")
        room_id = res.json()["id"]

        res = self.client2.patch(_room_url(room_id), {"title": "Ele Geçirildi"}, format="json")
        self.assertEqual(res.status_code, 404)
        self.assertEqual(ChatRoom.objects.get(id=room_id).title, "Orijinal")

    def test_baska_kullanicinin_mesajlarini_goremez(self):
        res = self.client1.post(ROOMS_URL, {"title": "Gizli Oda"}, format="json")
        room_id = res.json()["id"]
        room = ChatRoom.objects.get(id=room_id)
        ChatMessage.objects.create(room=room, role="user", content="Gizli mesaj")

        res = self.client2.get(_messages_url(room_id))
        self.assertEqual(res.status_code, 403)


# ── 4. Mesaj akışı ────────────────────────────────────────────────────────────

class MessageFlowTest(TestCase):
    """
    Senaryo: Oda oluştur → farklı rollerde mesajlar ekle → sıralı listele.
    """

    def setUp(self):
        self.bl = mock.patch("chat.authentication.is_blacklisted", return_value=False)
        self.bl.start()
        self.client = _authed_client(user_id=1)
        res = self.client.post(ROOMS_URL, {"title": "Mesaj Test Odası"}, format="json")
        self.room_id = res.json()["id"]
        self.room = ChatRoom.objects.get(id=self.room_id)

    def tearDown(self):
        self.bl.stop()

    def test_bos_oda_mesaj_listesi_bos(self):
        res = self.client.get(_messages_url(self.room_id))
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), [])

    def test_mesajlar_ekleme_sirasinda_listelenir(self):
        ChatMessage.objects.create(room=self.room, role="user", content="İlk soru")
        ChatMessage.objects.create(room=self.room, role="assistant", content="İlk cevap")
        ChatMessage.objects.create(room=self.room, role="user", content="İkinci soru")

        res = self.client.get(_messages_url(self.room_id))
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(len(data), 3)
        self.assertEqual(data[0]["role"], "user")
        self.assertEqual(data[0]["content"], "İlk soru")
        self.assertEqual(data[1]["role"], "assistant")
        self.assertEqual(data[2]["role"], "user")

    def test_olmayan_oda_mesajlari_404(self):
        res = self.client.get(_messages_url(99999))
        self.assertEqual(res.status_code, 404)


# ── 5. Oda validasyonu ────────────────────────────────────────────────────────

class ChatRoomValidationTest(TestCase):
    def setUp(self):
        self.client = _authed_client(user_id=1)
        self.bl = mock.patch("chat.authentication.is_blacklisted", return_value=False)
        self.bl.start()

    def tearDown(self):
        self.bl.stop()

    def test_bos_baslik_400(self):
        res = self.client.post(ROOMS_URL, {"title": ""}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_baslik_olmadan_400(self):
        res = self.client.post(ROOMS_URL, {}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_guncelleme_bos_baslik_400(self):
        res = self.client.post(ROOMS_URL, {"title": "Geçici"}, format="json")
        room_id = res.json()["id"]
        res = self.client.patch(_room_url(room_id), {"title": "   "}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_olmayan_oda_guncelleme_404(self):
        res = self.client.patch(_room_url(99999), {"title": "Yeni"}, format="json")
        self.assertEqual(res.status_code, 404)

    def test_olmayan_oda_silme_404(self):
        res = self.client.delete(_room_url(99999))
        self.assertEqual(res.status_code, 404)


# ── 6. ChatRepository doğrudan birim testleri ─────────────────────────────────

class ChatRepositoryTest(TestCase):
    """Repository'nin DB mantığını doğrudan test eder."""

    def setUp(self):
        self.room = ChatRoom.objects.create(user_id=1, title="Repo Odası")

    def test_kullanicinin_odalari_getirilir(self):
        from chat.repositories import ChatRepository
        ChatRoom.objects.create(user_id=2, title="Başkasının")
        odalar = list(ChatRepository.get_rooms_by_user(user_id=1))
        self.assertTrue(all(r.user_id == 1 for r in odalar))
        self.assertEqual(len(odalar), 1)

    def test_oda_id_ile_getirilir(self):
        from chat.repositories import ChatRepository
        oda = ChatRepository.get_room_by_id(self.room.pk)
        self.assertEqual(oda.pk, self.room.pk)

    def test_olmayan_oda_none_doner(self):
        from chat.repositories import ChatRepository
        self.assertIsNone(ChatRepository.get_room_by_id(99999))

    def test_oda_olusturulur(self):
        from chat.repositories import ChatRepository
        oda = ChatRepository.create_room(title="Yeni Oda", user_id=1)
        self.assertIsNotNone(oda.pk)
        self.assertEqual(oda.title, "Yeni Oda")
        self.assertEqual(oda.user_id, 1)

    def test_mesaj_olusturulur(self):
        from chat.repositories import ChatRepository
        msg = ChatRepository.create_message(
            room_obj=self.room, role="user", content="Test mesajı"
        )
        self.assertIsNotNone(msg.pk)
        self.assertEqual(msg.content, "Test mesajı")
        self.assertEqual(msg.room, self.room)

    def test_odanin_mesajlari_getirilir(self):
        from chat.repositories import ChatRepository
        ChatMessage.objects.create(room=self.room, role="user", content="Mesaj 1")
        ChatMessage.objects.create(room=self.room, role="assistant", content="Mesaj 2")
        mesajlar = list(ChatRepository.get_messages_by_room(room_id=self.room.pk))
        self.assertEqual(len(mesajlar), 2)

    def test_baslik_guncellenir(self):
        from chat.repositories import ChatRepository
        sonuc = ChatRepository.update_room_title(room_id=self.room.pk, user_id=1, title="Yeni Başlık")
        self.assertTrue(sonuc)
        self.room.refresh_from_db()
        self.assertEqual(self.room.title, "Yeni Başlık")

    def test_yanlis_kullanici_baslik_guncelleyemez(self):
        from chat.repositories import ChatRepository
        sonuc = ChatRepository.update_room_title(room_id=self.room.pk, user_id=999, title="Hacklendi")
        self.assertFalse(sonuc)
        self.room.refresh_from_db()
        self.assertEqual(self.room.title, "Repo Odası")

    def test_oda_silinir(self):
        from chat.repositories import ChatRepository
        pk = self.room.pk
        sonuc = ChatRepository.delete_room(room_id=pk, user_id=1)
        self.assertTrue(sonuc)
        self.assertFalse(ChatRoom.objects.filter(pk=pk).exists())

    def test_yanlis_kullanici_silme_false_doner(self):
        from chat.repositories import ChatRepository
        sonuc = ChatRepository.delete_room(room_id=self.room.pk, user_id=999)
        self.assertFalse(sonuc)
        self.assertTrue(ChatRoom.objects.filter(pk=self.room.pk).exists())

    def test_oda_silinince_mesajlar_da_silinir(self):
        from chat.repositories import ChatRepository
        ChatMessage.objects.create(room=self.room, role="user", content="Silinecek")
        pk = self.room.pk
        ChatRepository.delete_room(room_id=pk, user_id=1)
        self.assertEqual(ChatMessage.objects.filter(room_id=pk).count(), 0)

    def test_sahip_odaya_erisebilir(self):
        from chat.repositories import ChatRepository
        self.assertTrue(ChatRepository.user_can_access_room(self.room.pk, 1))

    def test_sahip_olmayan_odaya_erisemez(self):
        from chat.repositories import ChatRepository
        self.assertFalse(ChatRepository.user_can_access_room(self.room.pk, 999))

    def test_olmayan_oda_erisim_false(self):
        from chat.repositories import ChatRepository
        self.assertFalse(ChatRepository.user_can_access_room(99999, 1))

    def test_gecersiz_oda_id_erisim_false(self):
        from chat.repositories import ChatRepository
        self.assertFalse(ChatRepository.user_can_access_room("abc", 1))
        self.assertFalse(ChatRepository.user_can_access_room(None, 1))


# ── 6b. Oda erişim endpoint'i (servisler arası doğrulama) ────────────────────

class RoomAccessEndpointTest(TestCase):
    """
    Senaryo: graph_module, room_id sahipliğini bu endpoint'ten doğrular.
    Sahip → 200, yabancı → 403, olmayan oda → 403.
    """

    def setUp(self):
        self.bl = mock.patch("chat.authentication.is_blacklisted", return_value=False)
        self.bl.start()
        self.client1 = _authed_client(user_id=1, email="user1@chat.com")
        self.client2 = _authed_client(user_id=2, email="user2@chat.com")
        res = self.client1.post(ROOMS_URL, {"title": "Erişim Test Odası"}, format="json")
        self.room_id = res.json()["id"]

    def tearDown(self):
        self.bl.stop()

    def _access_url(self, pk):
        return f"/api/chat/rooms/{pk}/access/"

    def test_sahip_200_allowed_true(self):
        res = self.client1.get(self._access_url(self.room_id))
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()["allowed"])

    def test_sahip_olmayan_403(self):
        res = self.client2.get(self._access_url(self.room_id))
        self.assertEqual(res.status_code, 403)
        self.assertFalse(res.json()["allowed"])

    def test_olmayan_oda_403(self):
        res = self.client1.get(self._access_url(99999))
        self.assertEqual(res.status_code, 403)

    def test_token_olmadan_erisilemez(self):
        res = APIClient().get(self._access_url(self.room_id))
        self.assertIn(res.status_code, [401, 403])


# ── 7. WebSocket oda erişim kontrolü ─────────────────────────────────────────

@override_settings(CHANNEL_LAYERS={"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}})
class WebSocketRoomAccessTest(TransactionTestCase):
    """
    Senaryo: WS bağlantısında JWT geçerli olsa bile kullanıcı yalnızca
    kendi odasına auth olabilir. Yabancı oda → 4004 ile kapanır.
    """

    def setUp(self):
        self.bl = mock.patch("chat.consumers.is_blacklisted", return_value=False)
        self.bl.start()
        self.room = ChatRoom.objects.create(user_id=1, title="WS Test Odası")

    def tearDown(self):
        self.bl.stop()

    def _communicator(self, room_id):
        from channels.testing import WebsocketCommunicator
        from channels.routing import URLRouter
        from chat.routing import websocket_urlpatterns
        return WebsocketCommunicator(URLRouter(websocket_urlpatterns), f"/ws/graph/chat/{room_id}/")

    async def _auth(self, communicator, user_id):
        connected, _ = await communicator.connect()
        self.assertTrue(connected)
        token = _make_token(user_id=user_id)
        await communicator.send_to(text_data=json.dumps({"type": "auth", "token": token}))

    async def test_sahip_auth_ok_alir(self):
        communicator = self._communicator(self.room.pk)
        try:
            await self._auth(communicator, user_id=1)
            response = json.loads(await communicator.receive_from())
            self.assertEqual(response["type"], "auth_ok")
        finally:
            await communicator.disconnect()

    async def test_sahip_olmayan_4004_ile_kapanir(self):
        communicator = self._communicator(self.room.pk)
        try:
            await self._auth(communicator, user_id=2)
            event = await communicator.receive_output()
            self.assertEqual(event["type"], "websocket.close")
            self.assertEqual(event["code"], 4004)
        finally:
            await communicator.disconnect()

    async def test_olmayan_oda_4004_ile_kapanir(self):
        communicator = self._communicator(99999)
        try:
            await self._auth(communicator, user_id=1)
            event = await communicator.receive_output()
            self.assertEqual(event["type"], "websocket.close")
            self.assertEqual(event["code"], 4004)
        finally:
            await communicator.disconnect()
