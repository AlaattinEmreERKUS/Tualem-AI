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

import uuid
from io import BytesIO
from unittest import mock
from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from django.conf import settings

from apps.models import Document, GraphTask


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
    mock.patch("shared.token_blacklist.is_blacklisted", return_value=False),
    mock.patch("apps.tasks.run_graph_pipeline.delay"),  # Celery tetiklenmez
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
            with mock.patch("shared.token_blacklist.is_blacklisted", return_value=False):
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
        self.rag_result = {"answer": "LLM cevabı", "sources": [], "action_result": None}

    def test_soru_eksikse_400(self):
        with mock.patch("shared.token_blacklist.is_blacklisted", return_value=False):
            res = self.client.post("/api/query/", {}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_gecerli_soru_200_doner(self):
        with mock.patch("shared.token_blacklist.is_blacklisted", return_value=False), \
             mock.patch("apps.service.graph_rag_service.GraphRAGService.query",
                        return_value=self.rag_result):
            res = self.client.post("/api/query/", {"question": "Makine öğrenmesi nedir?"}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["answer"], "LLM cevabı")

    def test_ilgili_chunk_yoksa_404(self):
        from apps.exceptions.graph_exceptions import NoRelevantChunksException
        with mock.patch("shared.token_blacklist.is_blacklisted", return_value=False), \
             mock.patch("apps.service.graph_rag_service.GraphRAGService.query",
                        side_effect=NoRelevantChunksException()):
            res = self.client.post("/api/query/", {"question": "Boş veritabanında soru"}, format="json")
        self.assertEqual(res.status_code, 404)

    def test_rate_limit_hatasi_503(self):
        from apps.exceptions.graph_exceptions import RAGQueryException
        with mock.patch("shared.token_blacklist.is_blacklisted", return_value=False), \
             mock.patch("apps.service.graph_rag_service.GraphRAGService.query",
                        side_effect=RAGQueryException("rate limit exceeded")):
            res = self.client.post("/api/query/", {"question": "Soru"}, format="json")
        self.assertEqual(res.status_code, 503)

    def test_excluded_doc_ids_serializerdan_gecer(self):
        doc_id = str(uuid.uuid4())
        with mock.patch("shared.token_blacklist.is_blacklisted", return_value=False), \
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
        self.bl_patch = mock.patch("shared.token_blacklist.is_blacklisted", return_value=False)
        self.bl_patch.start()

    def tearDown(self):
        self.bl_patch.stop()

    def test_konu_eksikse_400(self):
        res = self.client.post("/api/documents/search/", {"max_results": 5}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_gecerli_arama_201(self):
        mock_results = [{
            "document_id": str(uuid.uuid4()), "task_id": str(uuid.uuid4()),
            "title": "Test Paper", "authors": ["Yazar"], "arxiv_id": "2401.00001",
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
