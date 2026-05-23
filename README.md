# Tualem-AI

Graph RAG sistemi. Kullanıcının yüklediği dokümanları Neo4j (graph) ve Pinecone (vector) veritabanlarına gömer, LangGraph pipeline'ları ile işler, OpenRouter üzerinden LLM çağrısı yapar.

## Mimari

```
[Client]
   |
[Nginx :80]
   |          |
[user_module  [graph_module
   :8001]       :8002]
   |              |
[SQLite]    [SQLite + Neo4j + Pinecone]
                  |
            [Celery Worker]
                  |
            [Redis :6379]
```

| Servis | Port | Görev |
|--------|------|-------|
| user_module | 8001 | Kayıt, giriş, JWT token |
| graph_module | 8002 | Doküman yükleme, graph/vector embedding, RAG |
| Nginx | 80 | Reverse proxy |
| Redis | 6379 | Celery broker |

---

## Kurulum

### 1. Gereksinimler

- Python 3.13+
- [uv](https://docs.astral.sh/uv/) — paket yöneticisi
- [nginx](https://nginx.org/en/download.html) — reverse proxy
- [Redis](https://redis.io/download/) — Celery broker (Docker ile kolay)
- Neo4j ve Pinecone hesabı (cloud veya local)

### 2. uv Kur

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
# Terminali yeniden aç veya:
$env:Path = "C:\Users\$env:USERNAME\.local\bin;$env:Path"
```

### 3. Projeyi Klonla ve Bağımlılıkları Kur

```powershell
git clone <repo-url>
cd Tualem-AI
uv sync --all-packages --dev
```

Bu komut `.venv` oluşturur ve tüm servislerin bağımlılıklarını kurar.

### 4. Ortam Değişkenlerini Ayarla

**graph_module:**
```powershell
copy modules\graph_module\.env.example modules\graph_module\.env
```
`.env` dosyasını aç ve doldur:
```
NEO4J_URI=neo4j+s://<instance>.databases.neo4j.io
NEO4J_USER=<kullanici>
NEO4J_PASSWORD=<sifre>
OPENROUTER_API_KEY=<anahtar>
PINECONE_API_KEY=<anahtar>
PINECONE_INDEX_NAME=tualem-docs
JWT_SECRET_KEY=<gizli-anahtar>
```

**user_module:**
```powershell
# modules\user_module\.env dosyası oluştur:
JWT_SECRET_KEY=<user_module ile aynı anahtar>
```

> JWT_SECRET_KEY her iki serviste **aynı** olmalı — token doğrulaması için.

### 5. Veritabanı Migration

```powershell
.venv\Scripts\python modules\user_module\manage.py migrate
.venv\Scripts\python modules\graph_module\manage.py migrate
```

### 6. Redis Başlat

```powershell
# Docker varsa:
docker run -d -p 6379:6379 redis:alpine
```

### 7. nginx Kur

[nginx.org/en/download.html](https://nginx.org/en/download.html) adresinden Windows için indir.

Tavsiye edilen kurulum yeri: `C:\nginx\`

> PATH'e eklemeye gerek yok — `start.ps1` otomatik bulur.

### 8. Sistemi Başlat

```powershell
.\start.ps1
```

`start.ps1` şunları başlatır:
- user_module → http://localhost:8001
- graph_module → http://localhost:8002
- Nginx → http://localhost:80 (kuruluysa)

---

## Celery Worker

Doküman işleme async çalışır. Ayrı bir terminalde:

```powershell
cd modules\graph_module
..\..\venv\Scripts\celery -A core worker --loglevel=info
```

---

## Testler

```powershell
# user_module
cd modules\user_module
pytest

# graph_module
cd modules\graph_module
pytest
```

---

## Endpoint'ler

### Auth (user_module — :8001)

| Method | URL | Açıklama |
|--------|-----|----------|
| POST | `/register/` | Kayıt |
| POST | `/login/` | Giriş |
| POST | `/logout/` | Çıkış |
| POST | `/api/token/` | JWT token al |
| POST | `/api/token/refresh/` | Token yenile |
| POST | `/api/token/verify/` | Token doğrula |

### Dokümanlar (graph_module — :8002)

| Method | URL | Açıklama |
|--------|-----|----------|
| GET/POST | `/api/documents/` | Doküman listesi / yükle |
| GET/PUT/DELETE | `/api/documents/{id}/` | Doküman detay |
| GET | `/api/documents/{id}/chunks/` | Chunk listesi |
| GET | `/api/documents/{id}/chunks/{chunk_id}/` | Chunk detay |

Tüm `/api/` endpointleri `Authorization: Bearer <token>` header gerektirir.

---

## Proje Yapısı

```
Tualem-AI/
├── pyproject.toml              # uv workspace root
├── start.ps1                   # Tüm servisleri başlatır
├── nginx/
│   └── nginx.conf              # Reverse proxy config
└── modules/
    ├── user_module/            # Auth servisi (:8001)
    │   ├── pyproject.toml
    │   ├── apps/
    │   └── user_project/
    └── graph_module/           # RAG servisi (:8002)
        ├── pyproject.toml
        ├── apps/
        └── core/
```
