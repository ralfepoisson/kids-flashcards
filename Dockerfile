FROM node:24-bookworm-slim AS frontend
WORKDIR /build
COPY src/frontend/package.json src/frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY src/frontend/ ./
RUN npm run build -- --configuration production --base-href /flashcards/

FROM python:3.13-slim-bookworm AS application
ARG VCS_REF=unknown
ARG BUILD_DATE=unknown
LABEL org.opencontainers.image.title="Kids Flashcards" \
      org.opencontainers.image.revision="$VCS_REF" \
      org.opencontainers.image.created="$BUILD_DATE"
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    FRONTEND_DIR=/app/frontend \
    APP_BASE_PATH=/flashcards \
    UPLOAD_DIR=/app/uploads \
    INITIALIZE_SCHEMA=false
WORKDIR /app/backend
COPY src/backend/requirements.lock ./
RUN python -m pip install --no-cache-dir -r requirements.lock \
    && groupadd --gid 10001 flashcards \
    && useradd --uid 10001 --gid 10001 --no-create-home --shell /usr/sbin/nologin flashcards \
    && mkdir -p /app/uploads \
    && chown 10001:10001 /app/uploads
COPY src/backend/app/ ./app/
COPY src/backend/init_database.py src/backend/migrate_auth.py ./
COPY --from=frontend /build/dist/kids-flashcards/browser/ /app/frontend/
USER 10001:10001
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=4 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/flashcards/api/health', timeout=4).read()"
CMD ["python", "-m", "uvicorn", "app.production:app", "--host", "0.0.0.0", "--port", "8080", "--proxy-headers", "--forwarded-allow-ips", "*"]
