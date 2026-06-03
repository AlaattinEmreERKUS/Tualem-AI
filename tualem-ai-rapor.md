# Tualem-AI Sistem Teknik Raporu

**Hedef Kitle:** Sistemi daha önce hiç görmemiş bilgisayar mühendisleri  
**Tarih:** 3 Haziran 2026  
**Durum:** Aktif geliştirme (develop branch)

---

## 1. Projeye Genel Bakış

Tualem-AI, akademik ve araştırma odaklı bir **Graph RAG (Retrieval-Augmented Generation)** platformudur. Kullanıcılar PDF, DOCX ve PPTX formatındaki belgeleri yükler; sistem bu belgeleri işleyerek vektör ve bilgi grafiği veritabanlarına kaydeder. Ardından kullanıcı, yüklediği belgeler üzerinden gerçek zamanlı WebSocket bağlantısı ile yapay zeka destekli soru-cevap yapabilir.

**Temel yetenek:** Klasik vektör aramasını Neo4j bilgi grafiği ile birleştiren hibrit RAG mimarisi.

---

## 2. Teknoloji Yığını

| Katman | Teknoloji | Amaç |
|---|---|---|
| Backend framework | Django 6.0 + DRF | REST API, ORM, auth |
| Async/WebSocket | Django Channels 4.1 + Daphne | Gerçek zamanlı chat |
| Görev kuyruğu | Celery 5.3 + Redis | Async belge işleme pipeline |
| İlişkisel DB | PostgreSQL 16 + pgvector | Veriler + 768 boyutlu vektörler |
| Grafik DB | Neo4j 5 | Bilgi grafiği (entity/relation) |
| Cache/Broker | Redis 7 | Token blacklist, Celery, Channels |
| Embedding modeli | multilingual-e5-base (HuggingFace) | 768 boyutlu metin gömmeleri |
| LLM entegrasyonu | LangChain (Groq / Ollama / OpenRouter) | Dil modeli çağrıları |
| Frontend | Next.js 16 + React 19 + Tailwind CSS 4 | Kullanıcı arayüzü |
| Reverse proxy | Nginx 1.27 | Yönlendirme, rate limiting, WebSocket upgrade |
| Konteyner | Docker + Docker Compose | Tüm servislerin orkestrasyonu |
| Kimlik doğrulama | JWT (PyJWT, HS256) + Redis blacklist | Stateless auth + logout desteği |

---

## 3. Mimari: Mikroservis Yapısı

Sistem 4 bağımsız Django servisine bölünmüştür. Her biri ayrı port, ayrı veritabanı şeması ve ayrı sorumluluk alanına sahiptir.

```
İnternet
    │
    ▼
┌─────────────────────────────────────┐
│           Nginx :80                 │
│  Rate limiting, WebSocket upgrade,  │
│  reverse proxy routing              │
└──────┬──────────┬──────────┬────────┘
       │          │          │
       ▼          ▼          ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│  user_   │ │  graph_  │ │  chat_   │
│  module  │ │  module  │ │  module  │
│  :8001   │ │  :8002   │ │  :8003   │
│ (WSGI/   │ │ (WSGI/   │ │ (ASGI/   │
│ Gunicorn)│ │ Gunicorn)│ │ Daphne)  │
└────┬─────┘ └────┬─────┘ └────┬─────┘
     │             │             │
     └─────────────┼─────────────┘
                   ▼
     ┌─────────────────────────────┐
     │      PostgreSQL :5432       │
     │      Neo4j :7687            │
     │      Redis :6379            │
     └─────────────────────────────┘
                   ▲
     ┌─────────────┘
     │
┌────────────────┐
│ Celery Worker  │
│ (graph pipeline│
│  işçisi)       │
└────────────────┘
```

---

## 4. Servisler: Detaylı Açıklama

### 4.1 user_module (Port 8001)

**Sorumluluk:** Kullanıcı kimlik doğrulama ve profil yönetimi.

**Temel akışlar:**

1. **Kayıt:** `POST /api/auth/register/` → kullanıcı oluşturulur, e-posta doğrulama kodu Redis'e yazılır (10 dk TTL), e-posta gönderilir.
2. **Doğrulama:** `POST /api/auth/verify-email/` → kod Redis'te kontrol edilir, başarılıysa `access_token` + `refresh_token` döner.
3. **Giriş:** `POST /api/auth/login/` → JWT çifti döner.
4. **Çıkış:** `POST /api/auth/logout/` → token'ın `jti` değeri Redis'e blacklist olarak yazılır. Bu sayede token süresi dolmadan da geçersiz kılınır.
5. **Token yenileme:** `POST /api/auth/refresh/` → yeni access token döner.

**Veritabanı modeli:**

```
CustomUser
├── id, username (unique), email (unique)
├── password (hashed), fullname
├── profile_photo (ImageField)
└── created_at, updated_at
```

**Önemli tasarım kararı:** JWT stateless çalışır; logout sonrası token hâlâ kriptografik olarak geçerlidir. Sistem bunu Redis blacklist ile çözer — her korunan endpoint, token'ın `jti`'sinin Redis'te olup olmadığını kontrol eder.

---

### 4.2 graph_module (Port 8002)

**Sorumluluk:** Belge yükleme, işleme pipeline'ı, vektör ve grafik veritabanı yönetimi, RAG sorgu motoru.

**Belge İşleme Pipeline'ı (Celery ile async):**

```
Kullanıcı belge yükler (PDF/DOCX/PPTX)
          │
          ▼
    GraphTask oluşturulur (status: pending)
          │
          ▼
    Celery görevi kuyruğa girer (Redis broker)
          │
          ▼
    ┌─────────────────────────────────────┐
    │         run_graph_pipeline          │
    │                                     │
    │  1. text_extraction                 │
    │     (pypdf / python-docx / pptx)    │
    │          │                          │
    │  2. chunking                        │
    │     (RecursiveCharacterTextSplitter)│
    │          │                          │
    │  3. entity_extraction               │
    │     (LLM prompt → JSON entities)    │
    │          │                          │
    │  4. neo4j_write                     │
    │     (Entity + Relation node'ları)   │
    │          │                          │
    │  5. vector_write                    │
    │     (multilingual-e5-base → pgvect) │
    │          │                          │
    │  6. completed ✓                     │
    └─────────────────────────────────────┘
```

**RAG Sorgu Akışı:**

```
Soru gelir
    │
    ▼
VectorStore.search() → pgvector cosine similarity (≤0.65, top-k)
    │
    ▼
RAGRepository.get_graph_context() → Neo4j'de entity triples sorgular
    │
    ▼
Context birleştirme: [chunk metinleri] + [entity ilişkileri]
    │
    ▼
LangChain chain: RAG_PROMPT.format(context=..., question=...)
    │
    ▼
LLM yanıtı + kaynak listesi (document_id, chunk_index)
```

**Veritabanı modelleri:**

```
Document
├── id (UUID), user_id, room_id
├── file_name, file_type, file (FileField)
└── status: pending | processing | completed | failed

ContentChunk
├── id (UUID), document_id (FK)
├── content (TextField), chunk_index
└── embedding (vector(768)), is_embedded

GraphTask
├── id (UUID), document_id (FK)
├── current_step (pipeline aşaması)
└── error_message
```

**Neo4j Şema Yaklaşımı:**
- Node tipleri: `Person`, `Organization`, `Location`, `Concept`, `Event`, `Product`
- İlişki tipleri: `WORKS_AT`, `LOCATED_IN`, `FOUNDED_BY`, `RELATED_TO` vb. (LLM çıkarımı)
- Her chunk'tan çıkarılan entity'ler, chunk kimliğiyle ilişkilendirilir

**LLM sağlayıcı öncelik zinciri:**
```
GROQ_API_KEY varsa → ChatGroq (llama-3.1-70b)
    yoksa OLLAMA_BASE_URL varsa → ChatOllama (local)
        yoksa → ChatOpenAI wrapper → OpenRouter API
```

---

### 4.3 chat_module (Port 8003)

**Sorumluluk:** Gerçek zamanlı WebSocket chat, oda yönetimi, mesaj geçmişi, graph_module'e RAG proxy.

**Bu servis ASGI'dir** — Django Channels + Daphne çalışır. Diğer iki servis Gunicorn ile senkron (WSGI) çalışır; bu servis WebSocket için async mimariye geçmiştir.

**WebSocket Protokolü:**

```
1. Client → ws://host/ws/graph/chat/{room_id}/
   Server: bağlantıyı kabul eder, bekler

2. Client → { "type": "auth", "token": "<JWT>" }
   Server: JWT doğrular + Redis blacklist kontrol eder
   Server ← { "type": "auth_ok" }

3. Client → {
     "message": "Transformer nedir?",
     "provider": "groq",
     "model": "llama-3.1-70b-versatile",
     "excluded_doc_ids": []
   }

4. Server ← { "role": "user", "message": "...", "is_streaming": false }
   Server ← { "role": "system", "message": "Araştırılıyor..." }
   Server ← { "role": "assistant", "message": "...", "sources": [...] }
```

**chat_module → graph_module köprüsü:**  
`_relay_rag_query()` fonksiyonu, httpx ile `POST /api/query/` endpoint'ine HTTP isteği atar. graph_module'ün yanıtını WebSocket üzerinden istemciye iletir. İki servis arası direkt DB erişimi yoktur — HTTP proxy pattern kullanılır.

**REST Endpoint'leri (oda yönetimi):**

```
GET    /api/chat/rooms/               → kullanıcının odaları
POST   /api/chat/rooms/               → yeni oda oluştur
PATCH  /api/chat/rooms/<id>/          → oda başlığını güncelle
DELETE /api/chat/rooms/<id>/          → odayı sil
GET    /api/chat/rooms/<id>/messages/ → mesaj geçmişi
```

**Veritabanı modelleri:**

```
ChatRoom
├── id (AutoField), user_id (IntegerField)
├── title (default: "Yeni Araştırma Seansı")
└── created_at, updated_at (ordering: -updated_at)

ChatMessage
├── id (AutoField), room_id (FK → ChatRoom)
├── role: user | assistant | system
├── content (TextField)
└── sources (JSONField) — RAG kaynak referansları
```

---

### 4.4 frontend (Port 3000)

**Next.js 16 App Router** mimarisi. React 19, Tailwind CSS 4.

Temel sayfalar:
- `/login`, `/register` — Auth
- `/dashboard` — Ana çalışma alanı (belge yükleme + chat)
- `/profile` — Profil yönetimi

Backend ile iletişim: REST API için `fetch`, WebSocket için native `WebSocket` API.

---

## 5. Kimlik Doğrulama Mimarisi

Sistemde merkezi bir auth servisi yoktur — JWT doğrulaması her serviste tekrar edilir. Bunun için `shared/` dizini oluşturulmuştur.

```
shared/
├── jwt_utils.py       → token üretme ve doğrulama (HS256)
├── token_blacklist.py → Redis blacklist okuma/yazma
└── logging_config.py  → merkezi log formatı
```

Her servis bu dosyaları doğrudan import eder. Docker Compose, `shared/` dizinini her konteynere volume olarak bağlar.

**JWT yapısı:**

```json
{
  "user_id": 42,
  "username": "ali",
  "email": "ali@example.com",
  "token_type": "access",
  "jti": "uuid4-benzersiz-id",
  "iat": 1717000000,
  "exp": 1717028800
}
```

**Blacklist mekanizması:**  
Logout çağrısında token'ın `jti` değeri Redis'e yazılır:  
`SET jti:{jti_value} "" EX {kalan_süre_saniye}`  
Her korunan endpoint, gelen token'ın `jti`'sini Redis'te arar. Varsa 401 döner.

---

## 6. Veritabanı Katmanı

### PostgreSQL (Ana İlişkisel DB)

3 Django uygulamasına ait tablolar tek PostgreSQL instance'ında ayrı tablo prefix'leriyle tutulur:
- `users_customuser` → user_module
- `graph_document`, `graph_contentchunk`, `graph_graphtask` → graph_module
- `chat_chatroom`, `chat_chatmessage` → chat_module

**pgvector:** PostgreSQL'e kurulu extension ile `vector(768)` kolon tipi kullanılır. Cosine distance ile top-k arama yapılır.

### Neo4j (Bilgi Grafiği)

Belge pipeline'ı sırasında LLM'in metinden çıkardığı entity'ler ve aralarındaki ilişkiler Neo4j'e yazılır. RAG sırasında bu graph context, vektör aramasından dönen chunk'larla birleştirilir.

```cypher
-- Örnek sorgu (RAG context toplama)
MATCH (e:Entity)-[r]->(neighbor:Entity)
WHERE e.chunk_id IN $chunk_ids
RETURN e.name, type(r), neighbor.name
```

### Redis

| Kullanım | Key pattern | TTL |
|---|---|---|
| Token blacklist | `jti:{jti}` | Token kalan süresi |
| E-posta doğrulama kodu | `email_code:{email}` | 10 dakika |
| Resend cooldown | `resend_cooldown:{email}` | 1 dakika |
| Celery broker | `celery` prefix | — |
| Channels layer | `channels:` prefix | — |

---

## 7. Nginx Yapılandırması

```
Rate limiting: auth endpoint'leri → 5 istek/dakika
Max body size: 50MB (belge yükleme)
WebSocket timeout: 3600 saniye

Yönlendirme:
  /api/auth/*        → user_module:8001
  /api/documents/*   → graph_module:8002  (timeout: 300s)
  /api/query/        → graph_module:8002
  /api/chat/*        → chat_module:8003
  /ws/graph/chat/*   → chat_module:8003   (WebSocket upgrade)
  /user-media/       → user_module:8001   (static dosyalar)
  /                  → frontend:3000
```

---

## 8. Docker Compose Servisleri

| Servis | İmaj | Port (host) | Bağımlılık |
|---|---|---|---|
| postgres | pgvector/pgvector:pg16 | 5430 | — |
| neo4j | neo4j:5 | 7474, 7687 | — |
| redis | redis:7-alpine | 6375 | — |
| user_module | Python 3.13 | 8001 | postgres, redis |
| graph_module | Python 3.13 | 8002 | postgres, redis, neo4j |
| chat_module | Python 3.13 | 8003 | postgres, redis |
| celery_worker | Python 3.13 | — | postgres, redis, neo4j |
| frontend | Node 20 | 3001 | — |
| nginx | nginx:1.27 | 80 | tüm servisler |

**Başlatma sırası:** Docker Compose healthcheck mekanizması ile postgres → redis → neo4j sağlıklı olana kadar diğer servisler bekler.

**Kalıcı volumes:**
- `postgres_data` — DB dosyaları
- `neo4j_data` — Graf verileri
- `media_data` — Yüklenen belgeler
- `user_media_data` — Profil fotoğrafları
- `hf_cache` — HuggingFace model cache (multilingual-e5-base ilk başlatmada indirilir)

---

## 9. Servisler Arası İletişim Özeti

| Kaynak | Hedef | Protokol | Amaç |
|---|---|---|---|
| Nginx | Tüm servisler | HTTP/WS | Proxy/routing |
| chat_module | graph_module | HTTP (httpx) | RAG sorgu proxy |
| graph_module | Neo4j | Bolt (TCP) | Entity sorgu/yazma |
| graph_module | PostgreSQL | psycopg2 | CRUD |
| celery_worker | Redis | RESP | Job fetch/result |
| celery_worker | Neo4j | Bolt | Entity yazma |
| Tüm servisler | Redis | RESP | Blacklist + session |
| Tüm servisler | shared/ | Python import | JWT + logging |

---

## 10. Geliştirici Notları

**Kodu anlamak için başlangıç noktaları:**

| Ne anlamak istiyorsun | Nereye bak |
|---|---|
| Auth akışı | `modules/user_module/apps/views.py` |
| JWT üretimi/doğrulaması | `shared/jwt_utils.py` |
| Belge pipeline'ı | `modules/graph_module/apps/tasks.py` |
| RAG sorgu motoru | `modules/graph_module/apps/services/rag_service.py` |
| WebSocket consumer | `modules/chat_module/apps/consumers.py` |
| Neo4j client | `modules/graph_module/apps/neo4j_client.py` |
| Vektör store | `modules/graph_module/apps/vector_store.py` |
| Nginx routing | `nginx/nginx.conf` |
| Tüm servis yapısı | `docker-compose.yml` |

**Dikkat edilmesi gereken bağımlılıklar:**
- `JWT_SECRET` tüm servislerde aynı olmalı — farklı olursa cross-service token doğrulaması başarısız olur.
- HuggingFace `multilingual-e5-base` modeli ilk `celery_worker` başlatmasında indirilir — internet bağlantısı gerekir, `hf_cache` volume yoksa her restart'ta yeniden indirilir.
- graph_module ve chat_module aynı PostgreSQL instance'ını paylaşır ama birbirinin tablolarına erişmez — izolasyon uygulama katmanındadır, DB katmanında değil.

---

*Bu rapor Tualem-AI develop branch'inin 3 Haziran 2026 tarihli durumunu yansıtmaktadır.*
