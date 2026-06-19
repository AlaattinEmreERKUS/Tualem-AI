import os


def pytest_configure(config):
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
    os.environ.setdefault("DJANGO_SECRET_KEY", "test-secret-key-for-testing-only-not-production")
    os.environ.setdefault("JWT_SECRET", "test-jwt-secret-key-at-least-32-characters-long")
    os.environ.setdefault("REDIS_HOST", "localhost")
    os.environ.setdefault("REDIS_PORT", "6379")
    os.environ.setdefault("REDIS_PASSWORD", "")
