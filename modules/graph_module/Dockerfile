FROM python:3.13-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY modules/graph_module/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY modules/graph_module/ .
COPY shared/ ./shared/

EXPOSE ${PORT:-8002}

CMD sh -c "gunicorn core.wsgi:application --bind 0.0.0.0:${PORT:-8002} --workers 2"

