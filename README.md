# Tualem-AI

Graph RAG tabanlı doküman soru-cevap sistemi. Yüklenen dokümanlar PostgreSQL/pgvector ve Neo4j'de saklanır; Celery pipeline'ı ile chunk'lanıp embed edilir. Chat modülü üzerinden WebSocket bağlantısıyla gerçek zamanlı RAG sorgusu yapılabilir.

<img width="1915" height="950" alt="image" src="https://github.com/user-attachments/assets/1f4bb7c1-a364-4cbe-ae76-de9071298c11" />

---

## Mimari

```
[Client (Next.js)]
        |
   [Nginx :80]  ←── Rate limiting, WebSocket upgrade
    |       |       |
[user    [graph   [chat
 :8001]   :8002]   :8003 ASGI]
    |        |         |
    └────────┴─────────┘
             |
        [PostgreSQL :5430]   ←── pgvector (embedding)
        [Neo4j :7474/:7687]  ←── Bilgi grafı
        [Redis :6375]        ←── Celery broker + Channels layer + token blacklist
             |
       [Celery Worker]       ←── Async doküman pipeline
```

| Servis | Port | Görev |
|--------|------|-------|
| user_module | 8001 | Kayıt, email doğrulama, JWT, profil |
| graph_module | 8002 | Doküman yükleme, chunk/embed pipeline, Graph RAG |
| chat_module | 8003 | WebSocket chat, RAG entegrasyonu (Daphne/ASGI) |
| Nginx | 80 | Reverse proxy |
| PostgreSQL | 5430 | Ana veritabanı (pgvector uzantısıyla) |
| Neo4j | 7474/7687 | Bilgi grafı |
| Redis | 6375 | Celery broker + Django Channels layer + token blacklist |

---

## Kurulum

### 1. Gereksinimler

- Docker ve Docker Compose
- Bir LLM API anahtarı (OpenRouter, Groq veya yerel Ollama)
- SMTP hesabı (Gmail App Password veya benzeri)

### 2. Ortam Değişkenlerini Ayarla

```bash
cp .env.example .env
```

`.env` dosyasını düzenle:

```env
# PostgreSQL (host ortamı için — Docker override eder)
POSTGRES_DB=tualem_db
POSTGRES_USER=tualem_user
POSTGRES_PASSWORD=güçlü_şifre
POSTGRES_HOST=localhost
POSTGRES_PORT=5430

# Neo4j (Cloud Aura veya bolt://neo4j:7687)
NEO4J_URI=bolt://neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=neo4j_şifre

# Redis
REDIS_PASSWORD=redis_şifre
REDIS_URL=redis://:redis_şifre@localhost:6375/0

# JWT — tüm servisler arasında paylaşılan secret (min 32 karakter)
JWT_SECRET=cok_gizli_ve_uzun_bir_anahtar_min_32_karakter
JWT_ACCESS_TOKEN_LIFETIME_MINUTES=480
JWT_REFRESH_TOKEN_LIFETIME_DAYS=7

# LLM (OpenRouter, Groq veya Ollama — en az biri gerekli)
LLM_PROVIDER=groq
GROQ_API_KEY=
GROQ_MODEL=llama-3.1-70b-versatile

OPENROUTER_API_KEY=
EXTRACTION_MODEL=google/gemma-4-31b-it:free

OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b

# E-posta (email doğrulama için zorunlu)
# Gmail: Google Hesabı → Güvenlik → Uygulama Şifreleri
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=hesap@gmail.com
EMAIL_HOST_PASSWORD=xxxx xxxx xxxx xxxx
DEFAULT_FROM_EMAIL=Tualem AI <hesap@gmail.com>

# Django
DJANGO_SECRET_KEY=django_secret_key
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

> **Not:** `JWT_SECRET` tüm servislerde **aynı** olmalı. Docker ortamında Redis ve PostgreSQL bağlantıları `docker-compose.yml` içindeki environment override'lar ile otomatik doğru adrese yönlendirilir.

### 3. Sistemi Başlat

```bash
docker compose up --build
```

İlk başlatmada migration'lar otomatik çalışır. Frontend `http://localhost` adresinde hazır olur.

> Veritabanını sıfırlamak için:
> ```bash
> docker compose down -v && docker compose up --build
> ```

---

## Proje Yapısı

```
Tualem-AI/
├── docker-compose.yml
├── .env.example
├── nginx/
│   └── nginx.conf                  # Reverse proxy, rate limiting, WebSocket
├── shared/
│   ├── jwt_utils.py                # Servisler arası paylaşılan JWT
│   ├── token_blacklist.py          # Redis token blacklist
│   └── logging_config.py
└── modules/
    ├── user_module/                # Auth servisi (:8001)
    │   ├── Dockerfile
    │   ├── apps/
    │   │   ├── models.py           # CustomUser
    │   │   ├── views.py            # Register, Login, Verify, Profile, Logout
    │   │   ├── service/            # UserService
    │   │   ├── repositories/       # UserRepository
    │   │   └── tests.py            # Test suite
    │   └── user_project/           # Django settings & urls
    ├── graph_module/               # RAG servisi (:8002)
    │   ├── Dockerfile
    │   ├── apps/
    │   │   ├── models.py           # Document, ContentChunk, GraphTask
    │   │   ├── tasks.py            # Celery pipeline (extract→chunk→embed→graph)
    │   │   ├── neo4j_client.py     # Neo4j bağlantısı
    │   │   ├── repositories/       # graph_repository, rag_repository
    │   │   ├── service/            # graph_service, graph_rag_service, literature_search_service
    │   │   └── tests.py            # Test suite
    │   └── core/                   # Django settings & urls
    ├── chat_module/                # Chat servisi (:8003, ASGI/Daphne)
    │   ├── Dockerfile
    │   ├── chat/
    │   │   ├── consumers.py        # WebSocket consumer
    │   │   ├── models.py           # ChatRoom, ChatMessage
    │   │   ├── views.py            # REST: oda ve mesaj yönetimi
    │   │   ├── repositories.py     # ChatRepository
    │   │   └── tests.py            # Test suite
    │   └── core/                   # Django settings & urls
    └── frontend/                   # Next.js arayüzü
        └── src/app/
            ├── dashboard/page.js   # Ana çalışma alanı
            ├── login/page.js
            ├── register/page.js
            └── profile/page.js
```

---

## Endpoint'ler

### Auth (`user_module` — :8001)

| Method | URL | Auth | Açıklama |
|--------|-----|------|----------|
| POST | `/api/auth/register/` | Hayır | Kayıt — `requires_verification: true` döner |
| POST | `/api/auth/verify-email/` | Hayır | Email kodu doğrula — token döner |
| POST | `/api/auth/resend-code/` | Hayır | Doğrulama kodunu yeniden gönder |
| POST | `/api/auth/login/` | Hayır | Giriş — `access_token` + `refresh_token` döner |
| POST | `/api/auth/refresh/` | Hayır | Access token yenile |
| POST | `/api/auth/verify/` | Hayır | Token geçerliliğini kontrol et |
| POST | `/api/auth/logout/` | Evet | Çıkış — token blacklist'e eklenir |
| GET | `/api/auth/profile/` | Evet | Kullanıcı profili |
| PATCH | `/api/auth/profile/` | Evet | Profil güncelle (username, şifre, fotoğraf) |

**Kayıt akışı:**
```
POST /api/auth/register/  →  { requires_verification: true, email: "..." }
POST /api/auth/verify-email/  →  { access_token: "...", refresh_token: "..." }
```

### Dokümanlar (`graph_module` — :8002)

Tüm endpoint'ler `Authorization: Bearer <token>` gerektirir.

| Method | URL | Açıklama |
|--------|-----|----------|
| GET | `/api/documents/?room_id=<id>` | Doküman listesi (isteğe bağlı oda filtresi) |
| POST | `/api/documents/` | Doküman yükle (multipart/form-data, `file` + opsiyonel `room_id`) |
| GET | `/api/documents/{id}/` | Doküman detayı |
| DELETE | `/api/documents/{id}/` | Dokümanı sil (Neo4j + embedding temizliği dahil) |
| GET | `/api/documents/{id}/status/` | Pipeline durumu |
| GET | `/api/documents/{id}/chunks/` | Chunk listesi |
| POST | `/api/documents/search/` | arXiv'de ara ve pipeline'a sok (`topic`, `max_results`) |
| POST | `/api/query/` | Graph RAG sorgusu |

**Doküman yükleme örneği:**
```bash
curl -X POST http://localhost/api/documents/ \
  -H "Authorization: Bearer <token>" \
  -F "file=@makale.pdf" \
  -F "room_id=42"
```

**RAG sorgusu:**
```json
POST /api/query/
{
  "question": "Transformer mimarisi nasıl çalışır?",
  "top_k": 5,
  "provider": "groq",
  "model": "llama-3.1-70b-versatile",
  "room_id": "42",
  "excluded_doc_ids": []
}
```

### Chat (`chat_module` — :8003)

Tüm endpoint'ler `Authorization: Bearer <token>` gerektirir.

| Method | URL | Açıklama |
|--------|-----|----------|
| GET | `/api/chat/rooms/` | Kullanıcının sohbet odaları |
| POST | `/api/chat/rooms/` | Yeni oda oluştur (`title` alanı zorunlu) |
| PATCH | `/api/chat/rooms/{id}/` | Oda başlığını güncelle |
| DELETE | `/api/chat/rooms/{id}/` | Odayı sil |
| GET | `/api/chat/rooms/{id}/messages/` | Oda mesaj geçmişi |

### WebSocket (`chat_module` — Nginx üzerinden)

```
ws://localhost/ws/graph/chat/{room_id}/
```

**Bağlantı akışı:**
```json
// 1. Bağlandıktan sonra kimlik doğrula
{ "type": "auth", "token": "<jwt_access_token>" }

// 2. Sunucu onaylar
{ "type": "auth_ok" }

// 3. Mesaj gönder
{
  "message": "Yüklediğim belgelerde transfer learning var mı?",
  "provider": "groq",
  "model": "llama-3.1-70b-versatile",
  "excluded_doc_ids": []
}
```

**Sunucu event'leri:**
```json
{ "role": "user",      "message": "Yüklediğim...", "is_streaming": false }
{ "role": "system",    "message": "Araştırılıyor..." }
{ "role": "assistant", "message": "...", "is_streaming": false, "sources": [...] }
```

---

## LLM Sağlayıcıları

| `provider` değeri | Sağlayıcı | Gerekli env |
|-------------------|-----------|-------------|
| `groq` | Groq API | `GROQ_API_KEY`, `GROQ_MODEL` |
| `openrouter` | OpenRouter API | `OPENROUTER_API_KEY`, `EXTRACTION_MODEL` |
| `ollama` | Yerel Ollama | `OLLAMA_BASE_URL`, `OLLAMA_MODEL` |
| *(boş)* | Otomatik fallback | `LLM_PROVIDER` env değişkeni |

Fallback sırası: `GROQ_API_KEY` varsa Groq → `OLLAMA_BASE_URL` varsa Ollama → OpenRouter.

---

## Celery Pipeline Adımları

Doküman yüklendikten sonra pipeline şu sırayla çalışır:

```
text_extraction → chunking → entity_extraction → neo4j_write → vector_write → completed
```

Pipeline durumunu izlemek için:
```bash
GET /api/documents/{id}/status/
# → { "current_step": "chunking", "error_message": null }
```

---

## Testler

Her modülün test suite'i Docker container içinde çalıştırılır:

```bash
# user_module (SQLite, hızlı)
docker exec tualem_user_module python -m pytest apps/tests.py -v

# graph_module (PostgreSQL + pgvector gerekli)
docker exec tualem_graph_module python -m pytest apps/tests.py -v

# chat_module (PostgreSQL)
docker exec tualem_chat_module python -m pytest chat/tests.py -v
```

**Test stratejisi:**
- Gerçek JWT token üretimi ve doğrulaması
- Gerçek PostgreSQL operasyonları (DB'ye yazılır, DB'den okunur)
- Mock edilenler: SMTP, Celery task execution, Neo4j, LLM API çağrıları, Redis token blacklist

---

| Bölüm | Gerçekleştiren | Github Hesabı |
|-------------------|-----------|---------|
| `Frontend` | Tuğba KARACA | https://github.com/TugbaKaraca |
| `Backend` | Ali Eren BALLI | https://github.com/AliErenBalli |
| `Yapay Zeka ` | Alaattin Emre ERKUŞ | https://github.com/AlaattinEmreERKUS |
