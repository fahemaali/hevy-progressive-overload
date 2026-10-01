from pathlib import Path

import pytest
from flask.testing import FlaskClient

from backend.app import create_app
from backend.service import ProgressService
from backend.store import Store
from backend.sync import Refresher, Syncer
from tests.fakes import FakeHevy


def make_client(tmp_path: Path, dist: Path) -> FlaskClient:
    store = Store(tmp_path / "test.db")
    service = ProgressService(store, Refresher(Syncer(FakeHevy([], [], []), store)))
    return create_app(service, frontend_dist=dist).test_client()


@pytest.fixture
def dist(tmp_path: Path) -> Path:
    """A stand-in for the built frontend."""
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<!doctype html><html>app</html>")
    (dist / "assets" / "app.js").write_text("console.log('hi')")
    return dist


def test_health(tmp_path: Path, dist: Path) -> None:
    assert make_client(tmp_path, dist).get("/api/health").get_json() == {"status": "ok"}


def test_serves_built_files(tmp_path: Path, dist: Path) -> None:
    client = make_client(tmp_path, dist)
    assert b"<html>app" in client.get("/").data
    assert b"console.log" in client.get("/assets/app.js").data


def test_screen_addresses_get_the_app(tmp_path: Path, dist: Path) -> None:
    # Opening /muscles/chest directly (e.g. a shared link) loads the app, which shows the screen.
    resp = make_client(tmp_path, dist).get("/muscles/chest")
    assert resp.status_code == 200
    assert b"<html>app" in resp.data


def test_files_outside_the_build_are_not_served(tmp_path: Path, dist: Path) -> None:
    (tmp_path / "secret.txt").write_text("secret")
    resp = make_client(tmp_path, dist).get("/../secret.txt")
    assert b"secret" not in resp.data


def test_unknown_api_address_is_not_the_app(tmp_path: Path, dist: Path) -> None:
    resp = make_client(tmp_path, dist).get("/api/nope")
    assert resp.status_code == 404
    assert resp.is_json


def test_explains_when_the_frontend_is_not_built(tmp_path: Path) -> None:
    resp = make_client(tmp_path, tmp_path / "missing").get("/")
    assert resp.status_code == 404
    assert b"npm run build" in resp.data


def test_security_headers_on_every_response(tmp_path: Path, dist: Path) -> None:
    client = make_client(tmp_path, dist)
    for url in ["/", "/api/health", "/assets/app.js"]:
        headers = client.get(url).headers
        assert headers["X-Content-Type-Options"] == "nosniff"
        assert headers["X-Frame-Options"] == "DENY"
        assert "default-src 'self'" in headers["Content-Security-Policy"]
        assert "frame-ancestors 'none'" in headers["Content-Security-Policy"]


def test_assets_cached_forever_but_the_page_always_checked(tmp_path: Path, dist: Path) -> None:
    client = make_client(tmp_path, dist)
    assert "immutable" in client.get("/assets/app.js").headers["Cache-Control"]
    assert client.get("/").headers["Cache-Control"] == "no-cache"
    assert client.get("/muscles/chest").headers["Cache-Control"] == "no-cache"
