"""
Flask app factory. Serves the JSON API, and the frontend that calls it.
"""

import logging
from pathlib import Path
from typing import Any

from flask import Flask, Response, jsonify, request, send_from_directory
from werkzeug.exceptions import HTTPException

from backend.api.routes import api
from backend.service import ProgressService

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"

log = logging.getLogger(__name__)


def create_app(service: ProgressService | None = None) -> Flask:
    """`service` is injected in tests; by default it's built from environment variables."""
    app = Flask(__name__, static_folder=str(FRONTEND_DIR), static_url_path="")
    app.extensions["progress_service"] = service or ProgressService.from_env()
    app.register_blueprint(api)

    @app.get("/")
    def index() -> Response:
        return send_from_directory(FRONTEND_DIR, "index.html")

    @app.errorhandler(HTTPException)
    def http_error(err: HTTPException) -> Any:
        # Unknown /api/... addresses get a JSON error too, not an HTML page.
        if request.path.startswith("/api/"):
            return jsonify(error=err.description), err.code or 500
        return err

    @app.errorhandler(Exception)
    def unexpected_error(err: Exception) -> tuple[Response, int]:
        # Log the details; never send a stack trace to the browser.
        log.exception("Unhandled error on %s", request.path)
        return jsonify(error="Something went wrong. Please try again."), 500

    return app
