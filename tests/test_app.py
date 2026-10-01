from backend.app import create_app


def test_health() -> None:
    client = create_app().test_client()
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.get_json() == {"status": "ok"}


def test_serves_frontend() -> None:
    client = create_app().test_client()
    resp = client.get("/")
    assert resp.status_code == 200
    assert b"<html" in resp.data
