FROM python:3.13-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY modules/chat_module/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY modules/chat_module/ .
COPY shared/ ./shared/

ENV PYTHONPATH=/app

EXPOSE 8003

CMD ["sh", "-c", "python manage.py migrate --noinput && daphne -b 0.0.0.0 -p 8003 core.asgi:application"]
