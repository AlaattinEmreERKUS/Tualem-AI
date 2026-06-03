FROM python:3.13-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY modules/user_module/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY modules/user_module/ .
COPY shared/ ./shared/

EXPOSE ${PORT:-8001}

CMD sh -c "gunicorn user_project.wsgi:application --bind 0.0.0.0:${PORT:-8001} --workers 2"

