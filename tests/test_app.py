from pathlib import Path

from backend.app import create_app
from backend.service import ProgressService
from backend.store import Store
from backend.sync import Refresher, Syncer
from tests.fakes import FakeHevy


def test_serves_frontend_and_health(tmp_path: Path) -> None:
    store = Store(tmp_path / "test.db")
    service = ProgressService(store, Refresher(Syncer(FakeHevy([], [], []), store)))
    client = create_app(service).test_client()

    assert client.get("/api/health").get_json() == {"status": "ok"}
    page = client.get("/")
    assert page.status_code == 200
    assert b"<html" in page.data
