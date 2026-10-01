import json
import re
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import pytest
from flask.testing import FlaskClient

from backend.api.responses import BODY_MUSCLES
from backend.app import create_app
from backend.service import ProgressService
from backend.store import Store
from backend.sync import Refresher, Syncer
from tests.fakes import JSON, Clock, FakeHevy

TODAY = date(2026, 7, 22)  # the day of the last fixture workout


@pytest.fixture
def hevy(workouts: list[JSON], exercise_templates: list[JSON], routines: list[JSON]) -> FakeHevy:
    return FakeHevy(workouts, exercise_templates, routines)


def make_client(hevy: FakeHevy, tmp_path: Path, today: date = TODAY) -> FlaskClient:
    clock = Clock()
    store = Store(tmp_path / "test.db")
    service = ProgressService(
        store, Refresher(Syncer(hevy, store, now=clock), now=clock), lambda: today
    )
    return create_app(service).test_client()


@pytest.fixture
def client(hevy: FakeHevy, tmp_path: Path) -> FlaskClient:
    return make_client(hevy, tmp_path)


def get(client: FlaskClient, url: str, status: int = 200) -> Any:
    resp = client.get(url)
    assert resp.status_code == status, resp.get_data(as_text=True)
    assert resp.is_json
    return resp.get_json()


# --- Body map --------------------------------------------------------------------------


def test_body_map_lists_every_body_muscle(client: FlaskClient) -> None:
    data = get(client, "/api/body-map")
    assert data["as_of"] == "2026-07-22"
    assert [m["group"] for m in data["muscles"]] == list(BODY_MUSCLES)

    states = {m["group"]: m["state"] for m in data["muscles"]}
    assert states["chest"] == "progressing"
    assert states["lats"] == "not_progressing"
    assert states["triceps"] == "indirect_only"
    assert states["calves"] == "never_trained"
    assert not any(m["stale"] for m in data["muscles"])


def test_body_map_marks_stale_muscles(hevy: FakeHevy, tmp_path: Path) -> None:
    client = make_client(hevy, tmp_path, today=TODAY + timedelta(weeks=4))
    muscles = {m["group"]: m for m in get(client, "/api/body-map")["muscles"]}
    assert muscles["chest"]["stale"]
    assert muscles["chest"]["state"] == "progressing"  # still shows the last known status
    assert not muscles["triceps"]["stale"]  # not tracked, so never stale


# --- Muscle ----------------------------------------------------------------------------


def test_muscle(client: FlaskClient) -> None:
    chest = get(client, "/api/muscles/chest")
    assert (chest["label"], chest["state"]) == ("Chest", "progressing")
    assert chest["weeks"][-1]["trend"] == "up"
    assert [e["title"] for e in chest["exercises"]][:3] == [
        "Bench Press (Barbell)",
        "Chest Press (Machine)",
        "Push Up",
    ]
    bench = chest["exercises"][0]
    assert bench["latest"] == {"weight_kg": 52.5, "reps": [7, 7, 7], "duration_seconds": None}
    assert bench["best"]["reps"] == [9, 9, 9]
    assert bench["est_1rm_kg"] == 64.8


def test_untrained_muscle_is_empty_not_an_error(client: FlaskClient) -> None:
    calves = get(client, "/api/muscles/calves")
    assert (calves["state"], calves["weeks"], calves["exercises"]) == ("never_trained", [], [])


def test_unknown_muscle_is_404(client: FlaskClient) -> None:
    assert "error" in get(client, "/api/muscles/cardio", status=404)


# --- Exercise --------------------------------------------------------------------------


def test_exercise(client: FlaskClient) -> None:
    bench = get(client, "/api/exercises/T-BENCH")
    assert bench["title"] == "Bench Press (Barbell)"
    assert bench["default_range"] == "strength"

    [strength] = bench["ranges"]
    assert strength["trend"] == "down"
    assert len(strength["sessions"]) == 8
    first, last = strength["sessions"][0], strength["sessions"][-1]
    assert first["target"] is None  # a first session sets the baseline
    assert last["target"] == {"weight_kg": 55, "reps": 10, "duration_seconds": None, "sets": 3}
    assert last["vs_target"] == -1
    assert strength["plan"]["step"] == "building"
    assert strength["plan"]["rep_target"] == [8, 12]
    assert strength["plan"]["today"]["weight_kg"] == 52.5


def test_exercise_with_both_rep_ranges(client: FlaskClient) -> None:
    press = get(client, "/api/exercises/T-CHESTPRESS")
    assert {r["rep_range"] for r in press["ranges"]} == {"strength", "light"}
    assert press["default_range"] == "strength"


def test_assisted_exercise_says_lower_is_better(client: FlaskClient) -> None:
    assisted = get(client, "/api/exercises/T-ASSISTPULLUP")
    assert assisted["lower_is_better"]
    assert assisted["ranges"][0]["est_1rm_kg"] is None


@pytest.mark.parametrize("template_id", ["T-TREADMILL", "NOPE"])
def test_untracked_or_unknown_exercise_is_404(client: FlaskClient, template_id: str) -> None:
    assert "error" in get(client, f"/api/exercises/{template_id}", status=404)


# --- Search ----------------------------------------------------------------------------


def test_search_matches_every_word(client: FlaskClient) -> None:
    data = get(client, "/api/search?q=press machine")
    assert [e["title"] for e in data["exercises"]] == ["Chest Press (Machine)"]


def test_search_finds_muscles(client: FlaskClient) -> None:
    data = get(client, "/api/search?q=back")
    assert {m["group"] for m in data["muscles"]} == {"lower_back", "upper_back"}


def test_empty_search_lists_recent_tracked_exercises(client: FlaskClient) -> None:
    data = get(client, "/api/search")
    titles = [e["title"] for e in data["exercises"]]
    assert titles[0] in {"Lat Pulldown (Cable)", "Assisted Pull Up"}  # the last workout
    assert "Treadmill" not in titles  # not tracked
    assert data["muscles"] == []


# --- Status and errors -----------------------------------------------------------------


def test_status(client: FlaskClient) -> None:
    get(client, "/api/body-map")  # triggers the first sync
    assert get(client, "/api/status") == {
        "has_data": True,
        "synced_minutes_ago": 0,
        "refreshing": False,
        "refresh_failed": False,
    }


def test_no_data_yet_is_503(hevy: FakeHevy, tmp_path: Path) -> None:
    hevy.fail = True
    client = make_client(hevy, tmp_path)
    assert "isn't available yet" in get(client, "/api/body-map", status=503)["error"]
    assert get(client, "/api/status")["refresh_failed"]


def test_unknown_api_address_is_json_404(client: FlaskClient) -> None:
    assert "error" in get(client, "/api/nope", status=404)


def test_api_is_read_only(client: FlaskClient) -> None:
    resp = client.post("/api/body-map")
    assert resp.status_code == 405
    assert resp.is_json


def test_unexpected_errors_never_leak_details(
    client: FlaskClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def explode(self: ProgressService) -> None:
        raise RuntimeError("secret internal detail")

    monkeypatch.setattr(ProgressService, "snapshot", explode)
    resp = client.get("/api/body-map")
    assert resp.status_code == 500
    assert "secret" not in resp.get_data(as_text=True)


# --- Privacy ---------------------------------------------------------------------------


def every_response(client: FlaskClient) -> list[str]:
    """The text of every response the API can give for the fixture data."""
    urls = ["/api/body-map", "/api/search", "/api/search?q=a", "/api/status"]
    urls += [f"/api/muscles/{g}" for g in BODY_MUSCLES]
    template_ids = {e["id"] for e in get(client, "/api/search?q=")["exercises"]}
    urls += [f"/api/exercises/{i}" for i in template_ids]
    assert len(template_ids) == 6  # every tracked fixture exercise is covered
    return [client.get(url).get_data(as_text=True) for url in urls]


def test_responses_never_contain_private_data(client: FlaskClient) -> None:
    for text in every_response(client):
        assert "PRIVATE" not in text  # fixture notes and descriptions
        assert not re.search(r"\d{2}:\d{2}", text), "a time of day was exposed"
        assert "W-PUSH" not in text and "W-PULL" not in text  # workout ids
        keys = set(re.findall(r'"(\w+)":', text))
        assert not keys & {"notes", "description", "start_time", "end_time", "routine_id"}


def test_every_response_is_valid_json(client: FlaskClient) -> None:
    for text in every_response(client):
        json.loads(text)
