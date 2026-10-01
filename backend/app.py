"""
Flask app factory. Serves the JSON API, and the built frontend that calls it.
"""

import logging
from pathlib import Path
from typing import Any

from flask import Flask, Response, jsonify, request, send_from_directory
from werkzeug.exceptions import HTTPException, NotFound

from backend.api.routes import api
from backend.service import ProgressService

# Built by `npm run build` in frontend/. During development the Vite dev server
# serves the frontend instead, and forwards /api calls here.
FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"

# Only this site's own scripts, styles and data. Inline style attributes are allowed
# because the app sets colours and positions per element (e.g. chart dots).
CONTENT_SECURITY_POLICY = "; ".join(
    [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
    ]
)

log = logging.getLogger(__name__)


def create_app(
    service: ProgressService | None = None, frontend_dist: Path = FRONTEND_DIST
) -> Flask:
    """`service` is injected in tests; by default it's built from environment variables."""
    app = Flask(__name__, static_folder=None)
    app.extensions["progress_service"] = service or ProgressService.from_env()
    app.register_blueprint(api)

    @app.get("/", defaults={"path": ""})
    @app.get("/<path:path>")
    def frontend(path: str) -> Response:
        """Built files as they are; any other address is a screen of the single-page
        app (e.g. /muscles/chest), so it gets index.html and the app shows the screen."""
        if path.startswith("api/"):
            raise NotFound()
        if not (frontend_dist / "index.html").exists():
            raise NotFound("The frontend hasn't been built. Run `npm run build` in frontend/.")
        if path and (frontend_dist / path).is_file():
            return send_from_directory(frontend_dist, path)
        return send_from_directory(frontend_dist, "index.html")

    @app.after_request
    def security_headers(response: Response) -> Response:
        """Standard protections on every response."""
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Content-Security-Policy", CONTENT_SECURITY_POLICY)
        # Built assets have content hashes in their names, so they can be cached forever;
        # the page itself must always be checked, so new deploys show up straight away.
        if request.path.startswith("/assets/"):
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        elif not request.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-cache"
        return response

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
