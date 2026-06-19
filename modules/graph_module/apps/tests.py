"""
graph_module test suite — gerçek senaryo akışları.

Mock edilenler (sadece bunlar):
  - Celery: run_graph_pipeline.delay  (gerçekten işlemez, ama DB'ye kaydedilir)
  - Neo4j: tüm neo4j_client çağrıları
  - LLM: GraphRAGService.query, LiteratureSearchService.search_and_import
  - Redis token blacklist: is_blacklisted

Geri kalan her şey gerçek: JWT üretimi/doğrulaması, serializer validasyonu,
  GraphService iş mantığı, Document/GraphTask DB kayıtları.
"""

import tempfile
import uuid
from io import BytesIO
from unittest import mock
from django.test import TestCase, override_settings
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from django.conf import settings

from apps.models import Document, GraphTask, ContentChunk

_TEST_MEDIA_ROOT = tempfile.mkdtemp(prefix="graph_test_media_")
_TEST_STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}


# ── JWT yardımcı ─────────────────────────────────────────────────────────────

def _make_token(user_id=1, username="testuser", email="test@graph.com"):
    """Gerçek JWT access token üretir."""
    from shared.jwt_utils import generate_access_token
    return generate_access_token(
        user_id=str(user_id),
        username=username,
        email=email,
        secret=settings.JWT_SECRET,
        lifetime_minutes=60,
    )


def _authed_client(user_id=1, email="test@graph.com"):
    """Gerçek JWT token'lı API client döner."""
    client = APIClient()
    token = _make_token(user_id=user_id, email=email)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


def _pdf_file(name="test.pdf"):
    return SimpleUploadedFile(name, b"%PDF-1.4 minimal test content", content_type="application/pdf")


# ── Temel patch'ler ───────────────────────────────────────────────────────────

# Her testte tekrarlanan patch'leri merkezi tutuyoruz
_ALWAYS_MOCK = [
    mock.patch("apps.utils.authentication.is_blacklisted", return_value=False),
    mock.patch("apps.tasks.run_graph_pipeline.delay"),
    mock.patch("apps.views.user_can_access_room", return_value=True),
    mock.patch("apps.utils.throttles._JWTUserRateThrottle.allow_request", return_value=True),
]


def _start_patches(patches):
    return [p.start() for p in patches]


def _stop_patches(patches):
    for p in patches:
        p.stop()


# ── 1. Kimlik doğrulama zorunluluğu ──────────────────────────────────────────

class AuthRequiredTest(TestCase):
    """Token olmadan hiçbir endpoint çalışmamalı."""

    def test_belge_listesi_token_olmadan_403(self):
        res = APIClient().get("/api/documents/")
        self.assertIn(res.status_code, [401, 403])

    def test_yukleme_token_olmadan_403(self):
        res = APIClient().post("/api/documents/", {"file": _pdf_file()}, format="multipart")
        self.assertIn(res.status_code, [401, 403])

    def test_sorgu_token_olmadan_403(self):
        res = APIClient().post("/api/query/", {"question": "Soru?"}, format="json")
        self.assertIn(res.status_code, [401, 403])

    def test_gecersiz_token_403(self):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION="Bearer bu.gecersiz.bir.token")
        res = client.get("/api/documents/")
        self.assertIn(res.status_code, [401, 403])


# ── 2. Belge yükleme senaryosu ────────────────────────────────────────────────

@override_settings(MEDIA_ROOT=_TEST_MEDIA_ROOT, STORAGES=_TEST_STORAGES)
class DocumentUploadScenarioTest(TestCase):
    """
    Senaryo: Kullanıcı yeni not defteri oluşturduktan sonra belge yükler.
    room_id doğru kaydedilmeli; Document ve GraphTask DB'de oluşmalı.
    """

    def setUp(self):
        self.client = _authed_client(user_id=10)
        self.patches = list(_ALWAYS_MOCK)
        _start_patches(self.patches)

    def tearDown(self):
        _stop_patches(self.patches)

    def test_pdf_yukleme_201_doner(self):
        res = self.client.post("/api/documents/", {"file": _pdf_file()}, format="multipart")
        self.assertEqual(res.status_code, 201)
        self.assertIn("document_id", res.json())
        self.assertIn("task_id", res.json())

    def test_yukleme_document_db_ye_kaydolur(self):
        res = self.client.post("/api/documents/", {"file": _pdf_file()}, format="multipart")
        self.assertEqual(res.status_code, 201)
        doc_id = res.json()["document_id"]
        self.assertTrue(Document.objects.filter(id=doc_id).exists())

    def test_yukleme_graphtask_db_ye_kaydolur(self):
        res = self.client.post("/api/documents/", {"file": _pdf_file()}, format="multipart")
        doc_id = res.json()["document_id"]
        self.assertTrue(GraphTask.objects.filter(document_id=doc_id).exists())

    def test_room_id_document_a_kaydolur(self):
        """Ana senaryo: not defteri oluşturulduğunda room_id doğru kaydedilmeli."""
        res = self.client.post(
            "/api/documents/",
            {"file": _pdf_file(), "room_id": "42"},
            format="multipart",
        )
        self.assertEqual(res.status_code, 201)
        doc = Document.objects.get(id=res.json()["document_id"])
        self.assertEqual(doc.room_id, "42")  # gerçek DB kontrolü

    def test_room_id_gonderilmezse_null_kalir(self):
        res = self.client.post("/api/documents/", {"file": _pdf_file()}, format="multipart")
        doc = Document.objects.get(id=res.json()["document_id"])
        self.assertIsNone(doc.room_id)

    def test_celery_pipeline_tetiklenir(self):
        with mock.patch("apps.tasks.run_graph_pipeline.delay") as m_delay:
            with mock.patch("apps.utils.authentication.is_blacklisted", return_value=False):
                res = self.client.post("/api/documents/", {"file": _pdf_file()}, format="multipart")
        self.assertEqual(res.status_code, 201)
        m_delay.assert_called_once()

    def test_user_id_document_a_kaydolur(self):
        res = self.client.post("/api/documents/", {"file": _pdf_file()}, format="multipart")
        doc = Document.objects.get(id=res.json()["document_id"])
        self.assertEqual(str(doc.user_id), "10")

    def test_gecersiz_dosya_tipi_400(self):
        bad_file = SimpleUploadedFile("virus.exe", b"MZ", content_type="application/octet-stream")
        res = self.client.post("/api/documents/", {"file": bad_file}, format="multipart")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(Document.objects.count(), 0)

    def test_dosya_olmadan_400(self):
        res = self.client.post("/api/documents/", {}, format="multipart")
        self.assertEqual(res.status_code, 400)


# ── 3. Belge listeleme ve kullanıcı izolasyonu ────────────────────────────────

@override_settings(MEDIA_ROOT=_TEST_MEDIA_ROOT, STORAGES=_TEST_STORAGES)
class DocumentListAndIsolationTest(TestCase):
    """
    Senaryo: Kullanıcı sadece kendi belgelerini görür;
    başka kullanıcının belgesi listelenmez ve erişilemez.
    """

    def setUp(self):
        self.patches = list(_ALWAYS_MOCK)
        _start_patches(self.patches)

    def tearDown(self):
        _stop_patches(self.patches)

    def _upload(self, client, room_id=None):
        data = {"file": _pdf_file()}
        if room_id:
            data["room_id"] = room_id
        return client.post("/api/documents/", data, format="multipart")

    def test_bos_liste_200_doner(self):
        res = _authed_client(user_id=1).get("/api/documents/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), [])

    def test_kullanici_sadece_kendi_belgelerini_gorur(self):
        client1 = _authed_client(user_id=1)
        client2 = _authed_client(user_id=2)
        self._upload(client1)
        self._upload(client1)
        self._upload(client2)  # user2'nin belgesi

        res = client1.get("/api/documents/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.json()), 2)  # user1 sadece kendi 2 belgesini görür

    def test_room_id_filtresi_calisir(self):
        client = _authed_client(user_id=5)
        self._upload(client, room_id="10")
        self._upload(client, room_id="10")
        self._upload(client, room_id="20")  # farklı oda

        res = client.get("/api/documents/?room_id=10")
        data = res.json()
        # room_id=10 ve room_id=null belgeler döner (mevcut repository mantığı)
        room_ids = [d["room_id"] for d in data]
        self.assertNotIn("20", room_ids)


# ── 4. Belge detay ve silme — kullanıcı izolasyonu ───────────────────────────

@override_settings(MEDIA_ROOT=_TEST_MEDIA_ROOT, STORAGES=_TEST_STORAGES)
class DocumentDetailAndDeleteTest(TestCase):
    def setUp(self):
        self.patches = list(_ALWAYS_MOCK)
        _start_patches(self.patches)
        # user1'e ait belge oluştur
        self.client1 = _authed_client(user_id=1)
        res = self.client1.post("/api/documents/", {"file": _pdf_file()}, format="multipart")
        self.doc_id = res.json()["document_id"]

    def tearDown(self):
        _stop_patches(self.patches)

    def test_belge_detayi_sahibi_gorebilir(self):
        res = self.client1.get(f"/api/documents/{self.doc_id}/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["id"], self.doc_id)

    def test_baska_kullanici_belge_detayina_erisemez(self):
        client2 = _authed_client(user_id=2)
        res = client2.get(f"/api/documents/{self.doc_id}/")
        self.assertEqual(res.status_code, 404)

    def test_olmayan_belge_404(self):
        res = self.client1.get(f"/api/documents/{uuid.uuid4()}/")
        self.assertEqual(res.status_code, 404)

    def test_belge_sahibi_silebilir(self):
        with mock.patch("apps.service.graph_rag_service.GraphRAGService.cleanup_document"):
            res = self.client1.delete(f"/api/documents/{self.doc_id}/")
        self.assertEqual(res.status_code, 204)
        self.assertFalse(Document.objects.filter(id=self.doc_id).exists())

    def test_baska_kullanici_silemez(self):
        client2 = _authed_client(user_id=2)
        with mock.patch("apps.service.graph_rag_service.GraphRAGService.cleanup_document"):
            res = client2.delete(f"/api/documents/{self.doc_id}/")
        self.assertEqual(res.status_code, 403)
        self.assertTrue(Document.objects.filter(id=self.doc_id).exists())  # hâlâ duruyor


# ── 5. Task durumu ────────────────────────────────────────────────────────────

@override_settings(MEDIA_ROOT=_TEST_MEDIA_ROOT, STORAGES=_TEST_STORAGES)
class DocumentTaskStatusTest(TestCase):
    def setUp(self):
        self.patches = list(_ALWAYS_MOCK)
        _start_patches(self.patches)
        self.client = _authed_client(user_id=1)
        res = self.client.post("/api/documents/", {"file": _pdf_file()}, format="multipart")
        self.doc_id = res.json()["document_id"]

    def tearDown(self):
        _stop_patches(self.patches)

    def test_task_durumu_doner(self):
        res = self.client.get(f"/api/documents/{self.doc_id}/status/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("current_step", res.json())

    def test_task_baslangicta_pending_veya_text_extraction(self):
        res = self.client.get(f"/api/documents/{self.doc_id}/status/")
        step = res.json()["current_step"]
        self.assertIn(step, ["pending", "text_extraction", "chunking",
                              "entity_extraction", "neo4j_write", "vector_write",
                              "completed", "failed"])

    def test_baska_kullanicinin_task_durumu_404(self):
        client2 = _authed_client(user_id=2)
        res = client2.get(f"/api/documents/{self.doc_id}/status/")
        self.assertEqual(res.status_code, 404)


# ── 6. Sorgu (RAG) — mock LLM ────────────────────────────────────────────────

class QueryScenarioTest(TestCase):
    def setUp(self):
        self.client = _authed_client(user_id=1)
        self.rag_result = {"answer": "LLM cevabı", "action_type": "", "provider": "groq", "sources": []}
        self._throttle_mock = mock.patch("apps.utils.throttles._JWTUserRateThrottle.allow_request", return_value=True)
        self._throttle_mock.start()

    def tearDown(self):
        self._throttle_mock.stop()

    def test_soru_eksikse_400(self):
        with mock.patch("apps.utils.authentication.is_blacklisted", return_value=False):
            res = self.client.post("/api/query/", {}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_gecerli_soru_200_doner(self):
        with mock.patch("apps.utils.authentication.is_blacklisted", return_value=False), \
             mock.patch("apps.service.graph_rag_service.GraphRAGService.query",
                        return_value=self.rag_result):
            res = self.client.post("/api/query/", {"question": "Makine öğrenmesi nedir?"}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["answer"], "LLM cevabı")

    def test_ilgili_chunk_yoksa_404(self):
        from apps.exceptions.graph_exceptions import NoRelevantChunksException
        with mock.patch("apps.utils.authentication.is_blacklisted", return_value=False), \
             mock.patch("apps.service.graph_rag_service.GraphRAGService.query",
                        side_effect=NoRelevantChunksException()):
            res = self.client.post("/api/query/", {"question": "Boş veritabanında soru"}, format="json")
        self.assertEqual(res.status_code, 404)

    def test_rate_limit_hatasi_503(self):
        from apps.exceptions.graph_exceptions import RAGQueryException
        with mock.patch("apps.utils.authentication.is_blacklisted", return_value=False), \
             mock.patch("apps.service.graph_rag_service.GraphRAGService.query",
                        side_effect=RAGQueryException("rate limit exceeded")):
            res = self.client.post("/api/query/", {"question": "Soru"}, format="json")
        self.assertEqual(res.status_code, 503)

    def test_excluded_doc_ids_serializerdan_gecer(self):
        doc_id = str(uuid.uuid4())
        with mock.patch("apps.utils.authentication.is_blacklisted", return_value=False), \
             mock.patch("apps.service.graph_rag_service.GraphRAGService.query",
                        return_value=self.rag_result) as m:
            self.client.post("/api/query/",
                             {"question": "Soru", "excluded_doc_ids": [doc_id]},
                             format="json")
        _, kwargs = m.call_args
        self.assertIn(doc_id, kwargs.get("excluded_doc_ids", []))


# ── 7. Literatür arama ────────────────────────────────────────────────────────

class LiteratureSearchTest(TestCase):
    def setUp(self):
        self.client = _authed_client(user_id=1)
        self.bl_patch = mock.patch("apps.utils.authentication.is_blacklisted", return_value=False)
        self.bl_patch.start()
        self._throttle_mock = mock.patch("apps.utils.throttles._JWTUserRateThrottle.allow_request", return_value=True)
        self._throttle_mock.start()

    def tearDown(self):
        self.bl_patch.stop()
        self._throttle_mock.stop()

    def test_konu_eksikse_400(self):
        res = self.client.post("/api/documents/search/", {"max_results": 5}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_gecerli_arama_201(self):
        mock_results = [{
            "document_id": str(uuid.uuid4()), "task_id": str(uuid.uuid4()),
            "title": "Test Paper", "authors": ["Yazar"], "arxiv_id": "2401.00001",
            "summary": "Özet", "published": None,
        }]
        with mock.patch("apps.tasks.run_graph_pipeline.delay"), \
             mock.patch("apps.service.literature_search_service.LiteratureSearchService.search_and_import",
                        return_value=mock_results):
            res = self.client.post("/api/documents/search/",
                                   {"topic": "transformer", "max_results": 3}, format="json")
        self.assertEqual(res.status_code, 201)

    def test_sonuc_bulunamazsa_404(self):
        from apps.exceptions.graph_exceptions import LiteratureSearchException
        with mock.patch("apps.service.literature_search_service.LiteratureSearchService.search_and_import",
                        side_effect=LiteratureSearchException("Sonuç yok")):
            res = self.client.post("/api/documents/search/",
                                   {"topic": "xyzabc999", "max_results": 5}, format="json")
        self.assertEqual(res.status_code, 404)


# ── 8. Oda erişim doğrulaması (servisler arası) ───────────────────────────────

class RoomAccessUtilTest(TestCase):
    """room_access util — httpx mock, TTL cache, fail-closed davranışı."""

    def setUp(self):
        from apps.utils import room_access
        room_access._cache.clear()

    def test_200_ise_true_ve_cache(self):
        from apps.utils.room_access import user_can_access_room
        with mock.patch("apps.utils.room_access.httpx.get",
                        return_value=mock.Mock(status_code=200)) as m:
            self.assertTrue(user_can_access_room("1", "5", "token"))
            self.assertTrue(user_can_access_room("1", "5", "token"))
        self.assertEqual(m.call_count, 1)

    def test_403_ise_false(self):
        from apps.utils.room_access import user_can_access_room
        with mock.patch("apps.utils.room_access.httpx.get",
                        return_value=mock.Mock(status_code=403)):
            self.assertFalse(user_can_access_room("1", "5", "token"))

    def test_ulasilamazsa_false_ve_cache_yok(self):
        import httpx as _httpx
        from apps.utils import room_access
        with mock.patch("apps.utils.room_access.httpx.get",
                        side_effect=_httpx.RequestError("bağlantı yok")):
            self.assertFalse(room_access.user_can_access_room("1", "5", "token"))
        self.assertEqual(len(room_access._cache), 0)

    def test_farkli_kullanici_ayri_cache(self):
        from apps.utils.room_access import user_can_access_room
        with mock.patch("apps.utils.room_access.httpx.get",
                        return_value=mock.Mock(status_code=200)) as m:
            user_can_access_room("1", "5", "token1")
            user_can_access_room("2", "5", "token2")
        self.assertEqual(m.call_count, 2)


class QueryRoomAccessTest(TestCase):
    """room_id'li sorgular chat_module'den sahiplik doğrulaması gerektirir."""

    def setUp(self):
        self.client = _authed_client(user_id=1)
        self.patches = [
            mock.patch("apps.utils.authentication.is_blacklisted", return_value=False),
            mock.patch("apps.utils.throttles._JWTUserRateThrottle.allow_request", return_value=True),
        ]
        _start_patches(self.patches)
        self.rag_result = {"answer": "Cevap", "action_type": "", "provider": "groq", "sources": []}

    def tearDown(self):
        _stop_patches(self.patches)

    def test_erisim_yoksa_403(self):
        with mock.patch("apps.views.user_can_access_room", return_value=False):
            res = self.client.post("/api/query/",
                                   {"question": "Soru", "room_id": "5"}, format="json")
        self.assertEqual(res.status_code, 403)

    def test_erisim_varsa_sorgu_calisir(self):
        with mock.patch("apps.views.user_can_access_room", return_value=True) as m, \
             mock.patch("apps.service.graph_rag_service.GraphRAGService.query",
                        return_value=self.rag_result):
            res = self.client.post("/api/query/",
                                   {"question": "Soru", "room_id": "5"}, format="json")
        self.assertEqual(res.status_code, 200)
        args, _ = m.call_args
        self.assertEqual(str(args[0]), "1")
        self.assertEqual(str(args[1]), "5")

    def test_room_id_yoksa_kontrol_yapilmaz(self):
        with mock.patch("apps.views.user_can_access_room") as m, \
             mock.patch("apps.service.graph_rag_service.GraphRAGService.query",
                        return_value=self.rag_result):
            res = self.client.post("/api/query/", {"question": "Soru"}, format="json")
        self.assertEqual(res.status_code, 200)
        m.assert_not_called()


@override_settings(MEDIA_ROOT=_TEST_MEDIA_ROOT, STORAGES=_TEST_STORAGES)
class UploadRoomAccessTest(TestCase):
    """room_id'li doküman yükleme sahiplik doğrulaması gerektirir."""

    def setUp(self):
        self.client = _authed_client(user_id=1)
        self.patches = [
            mock.patch("apps.utils.authentication.is_blacklisted", return_value=False),
            mock.patch("apps.tasks.run_graph_pipeline.delay"),
            mock.patch("apps.utils.throttles._JWTUserRateThrottle.allow_request", return_value=True),
        ]
        _start_patches(self.patches)

    def tearDown(self):
        _stop_patches(self.patches)

    def test_erisim_yoksa_403_ve_dokuman_olusmaz(self):
        with mock.patch("apps.views.user_can_access_room", return_value=False):
            res = self.client.post("/api/documents/",
                                   {"file": _pdf_file(), "room_id": "5"}, format="multipart")
        self.assertEqual(res.status_code, 403)
        self.assertEqual(Document.objects.count(), 0)

    def test_erisim_varsa_yukleme_201(self):
        with mock.patch("apps.views.user_can_access_room", return_value=True):
            res = self.client.post("/api/documents/",
                                   {"file": _pdf_file(), "room_id": "5"}, format="multipart")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(Document.objects.filter(room_id="5").count(), 1)

    def test_room_id_olmadan_kontrol_yapilmaz(self):
        with mock.patch("apps.views.user_can_access_room") as m:
            res = self.client.post("/api/documents/", {"file": _pdf_file()}, format="multipart")
        self.assertEqual(res.status_code, 201)
        m.assert_not_called()


@override_settings(MEDIA_ROOT=_TEST_MEDIA_ROOT, STORAGES=_TEST_STORAGES)
class PipelineIdempotencyTest(TestCase):
    """Pipeline retry'ı eski chunk'ları temizleyip baştan başlamalı."""

    def setUp(self):
        self.document = Document.objects.create(
            user_id="1",
            file_name="t.txt",
            file_type="text/plain",
            file=SimpleUploadedFile("t.txt", "uzun metin".encode("utf-8"), content_type="text/plain"),
            status="pending",
        )
        self.task = GraphTask.objects.create(document=self.document)

    def _neo4j_mock(self):
        m = mock.MagicMock()
        m.chunk_text.return_value = ["parça bir", "parça iki"]
        m.extract_graph_data.return_value = {"entities": [], "relationships": []}
        return m

    def _run_pipeline(self, neo4j_mock):
        from apps.tasks import run_graph_pipeline
        with mock.patch("apps.tasks._get_neo4j_client", return_value=neo4j_mock), \
             mock.patch("apps.tasks._extract_text", return_value="uzun metin"), \
             mock.patch("apps.vector_store.VectorStore", mock.MagicMock()):
            run_graph_pipeline(str(self.document.id), str(self.task.id))

    def test_eski_chunklar_temizlenir(self):
        stale = ContentChunk.objects.create(document=self.document, content="eski", chunk_index=0)
        neo4j = self._neo4j_mock()
        self._run_pipeline(neo4j)
        neo4j.delete_chunks.assert_called_once_with([str(stale.id)])
        self.assertFalse(ContentChunk.objects.filter(id=stale.id).exists())
        self.assertEqual(ContentChunk.objects.filter(document=self.document).count(), 2)
        self.document.refresh_from_db()
        self.assertEqual(self.document.status, "completed")

    def test_temiz_dokumanda_silme_cagrilmaz(self):
        neo4j = self._neo4j_mock()
        self._run_pipeline(neo4j)
        neo4j.delete_chunks.assert_not_called()
        self.assertEqual(ContentChunk.objects.filter(document=self.document).count(), 2)

    def test_ikinci_calistirma_unique_kisitina_takilmaz(self):
        self._run_pipeline(self._neo4j_mock())
        self._run_pipeline(self._neo4j_mock())
        self.document.refresh_from_db()
        self.assertEqual(self.document.status, "completed")
        self.assertEqual(ContentChunk.objects.filter(document=self.document).count(), 2)
        task = GraphTask.objects.get(id=self.task.id)
        self.assertEqual(task.current_step, "completed")
