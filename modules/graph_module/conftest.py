import os


def pytest_configure(config):
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
    os.environ.setdefault("DJANGO_SECRET_KEY", "test-secret-key-for-testing-only-not-production")
    os.environ.setdefault("JWT_SECRET", "test-jwt-secret-key-at-least-32-characters-long")
    os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
    os.environ.setdefault("NEO4J_URI", "bolt://localhost:7687")
    os.environ.setdefault("NEO4J_USER", "neo4j")
    os.environ.setdefault("NEO4J_PASSWORD", "test")
    os.environ.setdefault("OPENROUTER_API_KEY", "test-key")
    os.environ.setdefault("GROQ_API_KEY", "test-key")
