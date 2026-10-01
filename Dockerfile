# Two stages: build the React frontend with Node, then run it all with Python only.
# The final image has no Node, no frontend source and no dev tools in it.

# --- 1. Build the frontend ------------------------------------------------------------
FROM node:24-slim AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- 2. Run the app ---------------------------------------------------------------------
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    DATABASE_PATH=/app/data/hevy.db

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ backend/
COPY --from=frontend /frontend/dist frontend/dist

# Run as an unprivileged user; it only needs to write the local data copy.
RUN useradd --create-home app && mkdir -p data && chown app data
USER app

EXPOSE 8000
# One worker on purpose (see backend/wsgi.py); threads serve requests concurrently.
CMD gunicorn --workers 1 --threads 8 --bind 0.0.0.0:$PORT --access-logfile - backend.wsgi:app
