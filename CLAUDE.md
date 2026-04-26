# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: Nexus — Knowledge Graph AI Assistant

Microservices backend + React frontend. Users upload documents (PDF, Markdown); the system extracts concepts via Gemini API, stores relationships in Neo4j, and exposes a RAG-based chat interface over the user's personal knowledge graph.

## Architecture

### Service Map

| Service | Port | DB | Purpose |
|---|---|---|---|
| `user-service` | 8001 | PostgreSQL | JWT auth, user profiles |
| `document-service` | 8002 | PostgreSQL + RabbitMQ | File upload, metadata, triggers processing |
| `processing-service` | 8003 | PostgreSQL + RabbitMQ + Neo4j | Celery workers, text extraction, Gemini concept extraction |
| `graph-service` | 8004 | Neo4j only | Knowledge graph CRUD and search |
| `chat-service` | 8005 | PostgreSQL + Neo4j | RAG pipeline, Gemini chat, conversation history |
| `api-gateway` | 80 | — | Nginx reverse proxy, routes `/api/v1/<prefix>/` to correct service |

All services are independent Django apps. Inter-service communication is HTTP (service-to-service via Docker network names, e.g. `http://graph-service:8000`). The processing pipeline is async via Celery + RabbitMQ.

### Within each service

Each service follows strict layered architecture — **never skip layers**:

```
views → services → repositories → DB/external
```

- `views.py` — HTTP only, no business logic
- `services.py` — all business logic
- `repositories.py` — all DB queries (Repository Pattern — no raw ORM calls in views/services)
- `extractors.py` (processing-service only) — Strategy + Factory Pattern for file type handling

Settings split: `config/settings/base.py` → `development.py` / `production.py`. `DJANGO_SETTINGS_MODULE` defaults to `config.settings.development`.

### Key design patterns

- **Repository Pattern**: every DB interaction goes through a repository class. Don't call `Model.objects.*` directly in views or services.
- **Strategy + Factory** (`processing-service/apps/processor/extractors.py`): adding a new file type = new `BaseExtractor` subclass + register in `ExtractorFactory._registry`.
- **Celery task** (`processing-service/apps/tasks/tasks.py`): `process_document` task — extract text → extract concepts → push to graph-service.

## Commands

### Start everything

```bash
cp .env.example .env  # fill in credentials
# copy each services/.env.example to services/<name>/.env
docker-compose up --build
```

### Per-service development (without Docker)

```bash
cd services/<service-name>
pip install -r requirements.txt
cp .env.example .env  # fill credentials
python manage.py migrate
python manage.py runserver
```

### Run tests

```bash
# single service
cd services/<service-name>
python manage.py test

# single test class
python manage.py test apps.<app>.tests.test_views.MyTestClass

# single test method
python manage.py test apps.<app>.tests.test_views.MyTestClass.test_method
```

### Celery worker (processing-service)

```bash
cd services/processing-service
celery -A config worker --loglevel=info
```

### Migrations

```bash
cd services/<service-name>
python manage.py makemigrations
python manage.py migrate
```

## Environment variables

Each service has its own `.env` (from `.env.example`). Key variables:

- `SECRET_KEY`, `DJANGO_ENV` — all services
- `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST` — PostgreSQL services
- `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD` — processing, graph, chat services
- `RABBITMQ_URL` — document, processing services
- `GEMINI_API_KEY` — processing, chat services
- `GRAPH_SERVICE_URL` — chat-service (internal URL to graph-service)

Root `.env.example` holds Docker Compose-level variables (Postgres, Neo4j, RabbitMQ credentials).

## API routing (via Nginx gateway)

```
/api/v1/auth/           → user-service
/api/v1/users/          → user-service
/api/v1/documents/      → document-service (max body 50MB)
/api/v1/processor/      → processing-service
/api/v1/tasks/          → processing-service
/api/v1/graph/          → graph-service
/api/v1/conversations/  → chat-service
```

## Neo4j (graph-service)

Connection singleton lives in `apps/graph/neo4j_client.py` (`Neo4jClient.get_driver()`). All Cypher queries go through `GraphRepository`. graph-service has no relational DB — SQLite is declared only to satisfy Django's app framework.

## Frontend

Located at `frontend/`. Contains a `users/` directory. No build tooling is configured yet — check `frontend/` for current state before assuming React/Next.js setup.
