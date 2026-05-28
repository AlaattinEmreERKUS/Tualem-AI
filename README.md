# Tualem-AI

Graph RAG tabanlı doküman soru-cevap sistemi. Kullanıcının yüklediği dokümanlar PostgreSQL/pgvector ve Neo4j'de saklanır; Celery pipeline'ı ile chunk'lanıp embed edilir. Chat modülü üzerinden WebSocket bağlantısıyla gerçek zamanlı RAG sorgusu yapılabilir.

## Mimari

```
[Client]
    |
[Nginx :80]
    |           |           |
[user_module  [graph_module  [chat_module
   :8001]        :8002]         :8003]
    |              |               |
[PostgreSQL]  [PostgreSQL    [PostgreSQL
              + pgvector     + Redis]
              + Neo4j]
                   |
            [Celery Worker]
                   |
             [Redis :6379]
```

| Servis | Port | Görev |
|--------|------|-------|
| user_module | 8001 | Kayıt, giriş, JWT token üretimi |
| graph_module | 8002 | Doküman yükleme, chunk/embed pipeline, Graph RAG sorgusu |
| chat_module | 8003 | WebSocket chat, RAG entegrasyonu (Daphne/ASGI) |
| Nginx | 80 | Reverse proxy |
| PostgreSQL | 5430 | Ana veritabanı (pgvector uzantısıyla) |
| Neo4j | 7474/7687 | Bilgi grafı |
| Redis | 6379 | Celery broker + Django Channels layer |

---

## Kurulum

### 1. Gereksinimler

- Docker ve Docker Compose
- Bir LLM API anahtarı (OpenRouter, Groq veya yerel Ollama)

### 2. Ortam Değişkenlerini Ayarla

```bash
cp .env.example .env
```

`.env` dosyasını düzenle:

```env
# PostgreSQL
POSTGRES_DB=tualem_db
POSTGRES_USER=tualem_user
POSTGRES_PASSWORD=güçlü_şifre

# Neo4j
NEO4J_URI=bolt://neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=neo4j_şifre

# Redis
REDIS_URL=redis://redis:6379/0

# LLM (OpenRouter, Groq veya Ollama — en az biri gerekli)
OPENROUTER_API_KEY=
EXTRACTION_MODEL=openai/gpt-4o-mini

# JWT — tüm servisler arasında paylaşılan secret
JWT_SECRET=çok_gizli_ve_uzun_bir_anahtar
```

> `JWT_SECRET` tüm servislerde **aynı** olmalı — token doğrulaması bu değer üzerinden yapılır.

### 3. Sistemi Başlat

```bash
docker-compose up --build
```

İlk başlatmada migration'lar otomatik çalışır.

> Veritabanı şemasını sıfırlamak gerekiyorsa:
> ```bash
> docker-compose down -v && docker-compose up --build
> ```

### 4. Celery Worker

Doküman işleme pipeline'ı Celery ile async çalışır; `docker-compose up` ile birlikte otomatik başlar (`celery_worker` servisi).

---

## Proje Yapısı

```
Tualem-AI/
├── docker-compose.yml
├── .env.example
├── nginx/
│   └── nginx.conf              # Reverse proxy — 3 servis + WebSocket
├── shared/
│   └── jwt_utils.py            # Servisler arası paylaşılan JWT kütüphanesi
└── modules/
    ├── user_module/            # Auth servisi (:8001)
    │   ├── Dockerfile
    │   ├── apps/               # Kayıt, giriş, token view'ları
    │   └── core/               # Django settings & urls
    ├── graph_module/           # RAG servisi (:8002)
    │   ├── Dockerfile
    │   ├── apps/
    │   │   ├── models.py       # Document, ContentChunk, GraphTask
    │   │   ├── tasks.py        # Celery pipeline (chunk → embed → graph)
    │   │   ├── neo4j_client.py # Neo4j bağlantısı
    │   │   ├── repositories/   # graph_repository, rag_repository
    │   │   └── service/        # graph_service, graph_rag_service
    │   └── core/
    └── chat_module/            # Chat servisi (:8003, ASGI/Daphne)
        ├── Dockerfile
        ├── chat/
        │   ├── consumers.py    # WebSocket consumer — graph_module'a RAG isteği atar
        │   ├── middleware.py   # JWT token → scope["user_id"] / scope["token"]
        │   ├── models.py       # ChatRoom, ChatMessage
        │   └── views.py        # REST: oda ve mesaj yönetimi
        └── core/
```

---

## Endpoint'ler

### Auth (`user_module` — :8001)

| Method | URL | Açıklama |
|--------|-----|----------|
| POST | `/api/auth/register/` | Kullanıcı kaydı |
| POST | `/api/auth/login/` | Giriş — `access` ve `refresh` token döner |
| POST | `/api/auth/refresh/` | Access token yenile |
| POST | `/api/auth/verify/` | Token doğrula |

### Dokümanlar (`graph_module` — :8002)

Tüm endpointler `Authorization: Bearer <token>` gerektirir.

| Method | URL | Açıklama |
|--------|-----|----------|
| GET | `/api/documents/` | Kullanıcının doküman listesi |
| POST | `/api/documents/` | Doküman yükle (multipart/form-data) |
| GET | `/api/documents/{id}/` | Doküman detayı |
| DELETE | `/api/documents/{id}/` | Dokümanı sil (Neo4j + embedding temizliği dahil) |
| GET | `/api/documents/{id}/status/` | Celery pipeline durumu |
| GET | `/api/documents/{id}/chunks/` | Doküman chunk listesi |
| POST | `/api/documents/search/` | arXiv'de literatür ara, PDF'leri indir ve pipeline'a sok (`topic`, `max_results`) |
| POST | `/api/query/` | Graph RAG sorgusu (`question`, `top_k`, `provider`) |

### Chat (`chat_module` — :8003)

Tüm endpointler `Authorization: Bearer <token>` gerektirir.

| Method | URL | Açıklama |
|--------|-----|----------|
| GET | `/api/chat/rooms/` | Kullanıcının sohbet odaları |
| POST | `/api/chat/rooms/` | Yeni oda oluştur |
| GET | `/api/chat/rooms/{id}/` | Oda detayı |
| DELETE | `/api/chat/rooms/{id}/` | Odayı sil |
| GET | `/api/chat/rooms/{id}/messages/` | Oda mesaj geçmişi |

### WebSocket (`chat_module` — Nginx üzerinden)

```
ws://localhost/ws/graph/chat/{room_id}/?token=<jwt_access_token>
```

Bağlandıktan sonra mesaj gönder:

```json
{ "message": "Neo4j ile ilgili belgelerimde ne var?" }
```

Sunucu sırasıyla şu event'leri döner:

```json
{ "role": "user", "message": "Neo4j ile ilgili...", "is_streaming": false }
{ "role": "system", "message": "Grafik veritabanında araştırma yapılıyor..." }
{ "role": "assistant", "message": "...", "is_streaming": false, "sources": [...] }
```

---

## LLM Sağlayıcıları

`/api/query/` isteğinde `provider` alanıyla sağlayıcı seçilebilir:

| Değer | Sağlayıcı | Gereksinim |
|-------|-----------|------------|
| `openrouter` | OpenRouter API | `OPENROUTER_API_KEY` |
| `groq` | Groq API | `GROQ_API_KEY` |
| `ollama` | Yerel Ollama | Çalışan Ollama servisi |
| *(boş)* | Otomatik (env'e göre) | `LLM_PROVIDER` env değişkeni |
