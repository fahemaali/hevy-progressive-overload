from typing import Any

import pytest

from backend.hevy_client import ALLOWED_PATHS, BASE_URL, HevyClient, HevyError


class FakeResponse:
    def __init__(self, payload: dict[str, Any], status_code: int = 200):
        self._payload = payload
        self.status_code = status_code

    def json(self) -> dict[str, Any]:
        return self._payload

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


class FakeSession:
    """Stands in for requests.Session: serves canned pages and records every call."""

    def __init__(
        self, pages: dict[str, list[dict[str, Any]]] | None = None, status_code: int = 200
    ):
        self.pages = pages or {}
        self.status_code = status_code
        self.headers: dict[str, str] = {}
        self.calls: list[tuple[str, dict[str, Any]]] = []

    def get(self, url: str, params: dict[str, Any] | None = None, timeout: int = 0) -> FakeResponse:
        params = params or {}
        path = url.removeprefix(BASE_URL)
        self.calls.append((path, params))
        pages = self.pages.get(path, [{}])
        return FakeResponse(pages[params.get("page", 1) - 1], self.status_code)


def make_client(session: FakeSession) -> HevyClient:
    return HevyClient(api_key="test-key", session=session)  # type: ignore[arg-type]


def test_missing_key_raises_helpful_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("HEVY_API_KEY", raising=False)
    with pytest.raises(HevyError, match="HEVY_API_KEY is not set"):
        HevyClient()


def test_placeholder_key_is_rejected() -> None:
    with pytest.raises(HevyError):
        HevyClient(api_key="your_key_here")


def test_key_is_sent_as_header() -> None:
    session = FakeSession()
    make_client(session)
    assert session.headers["api-key"] == "test-key"


def test_paginates_until_last_page() -> None:
    session = FakeSession(
        {
            "/routines": [
                {"page": 1, "page_count": 2, "routines": [{"id": str(i)} for i in range(10)]},
                {"page": 2, "page_count": 2, "routines": [{"id": "10"}]},
            ]
        }
    )
    routines = make_client(session).get_all_routines()
    assert len(routines) == 11
    assert [params["page"] for _, params in session.calls] == [1, 2]


def test_stops_on_short_page_even_if_page_count_disagrees() -> None:
    session = FakeSession({"/routines": [{"page": 1, "page_count": 5, "routines": [{"id": "1"}]}]})
    assert len(make_client(session).get_all_routines()) == 1
    assert len(session.calls) == 1


def test_workout_events_pass_since_through() -> None:
    session = FakeSession({"/workouts/events": [{"page": 1, "page_count": 1, "events": []}]})
    make_client(session).get_workout_events(since="2026-09-01T00:00:00Z")
    _, params = session.calls[0]
    assert params["since"] == "2026-09-01T00:00:00Z"


@pytest.mark.parametrize(
    ("status", "message"),
    [(401, "rejected the API key"), (429, "rate limit")],
)
def test_http_errors_become_readable(status: int, message: str) -> None:
    client = make_client(FakeSession(status_code=status))
    with pytest.raises(HevyError, match=message):
        client.get_workout_count()


# --- Privacy --------------------------------------------------------------------


@pytest.mark.parametrize("path", ["/user/info", "/body_measurements", "/workouts/../user/info"])
def test_refuses_personal_data_endpoints(path: str) -> None:
    session = FakeSession()
    with pytest.raises(HevyError, match="not an allowed Hevy endpoint"):
        make_client(session)._get(path)
    assert session.calls == []


def test_every_public_method_stays_within_allowlist() -> None:
    session = FakeSession()
    client = make_client(session)
    client.get_workout_count = lambda: 0  # type: ignore[method-assign]  # count needs a payload
    client.get_all_workouts()
    client.get_workout_events(since="2026-01-01T00:00:00Z")
    client.get_all_exercise_templates()
    client.get_all_routines()
    assert {path for path, _ in session.calls} <= ALLOWED_PATHS
