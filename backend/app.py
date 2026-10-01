"""
Flask app factory. Serves the frontend and the JSON API the frontend calls.
For now it just serves the placeholder page and a health check, to prove the
whole stack runs end to end.
"""
from pathlib import Path
from flask import Flask, send_from_directory

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"


def create_app() -> Flask:
    app = Flask(__name__, static_folder=str(FRONTEND_DIR), static_url_path="")

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    @app.get("/")
    def index():
        return send_from_directory(FRONTEND_DIR, "index.html")

    return app
