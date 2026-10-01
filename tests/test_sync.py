import threading
from datetime import timedelta
from pathlib import Path

import pytest

from backend.store import Store
from backend.sync import MAX_AGE, RETRY_AFTER, SYNC_OVERLAP, Refresher, Syncer
from tests.fakes import JSON, T0, Clock, FakeHevy


@pytest.fixture
def hevy(workouts: list[JSON], exercise_templates: list[JSON], routines: list[JSON]) -> FakeHevy:
    return FakeHevy(workouts, exercise_templates, routines)


@pytest.fixture
def clock() -> Clock:
    return Clock()


@pytest.fixture
def syncer(hevy: FakeHevy, tmp_path: Path, clock: Clock) -> Syncer:
    return Syncer(hevy, Store(tmp_path / "test.db"), now=clock)


def updated(workout: JSON) -> JSON:
    return {"type": "updated", "workout": workout}


def deleted(workout_id: str) -> JSON:
    return {"type": "deleted", "id": workout_id, "deleted_at": "2026-07-01T13:00:00Z"}


# --- Syncer ----------------------------------------------------------------------------


def test_first_sync_copies_everything(syncer: Syncer, hevy: FakeHevy) -> None:
    result = syncer.sync()
    assert result.full
    assert result.updated == len(hevy.workouts)
    assert len(syncer.store.workouts()) == len(hevy.workouts)
    assert len(syncer.store.templates()) == len(hevy.templates)
    assert syncer.store.synced_at() == T0


def test_later_syncs_only_ask_for_changes(syncer: Syncer, hevy: FakeHevy, clock: Clock) -> None:
    syncer.sync()
    hevy.calls.clear()
    clock.advance(timedelta(hours=1))

    result = syncer.sync()

    assert not result.full
    since = (T0 - SYNC_OVERLAP).isoformat()
    assert hevy.calls == [f"events since {since}", "routines"]  # no full workout fetch
    assert syncer.store.synced_at() == T0 + timedelta(hours=1)


def test_applies_updates_and_deletes(syncer: Syncer, hevy: FakeHevy) -> None:
    syncer.sync()
    edited = {**hevy.workouts[0], "title": "Edited"}
    edited["exercises"] = edited["exercises"][:1]
    hevy.events = [updated(edited), deleted(hevy.workouts[1]["id"])]

    result = syncer.sync()

    stored = {w.id: w for w in syncer.store.workouts()}
    assert (result.updated, result.deleted) == (1, 1)
    assert len(stored[edited["id"]].exercises) == 1
    assert hevy.workouts[1]["id"] not in stored


def test_only_the_newest_event_per_workout_counts(syncer: Syncer, hevy: FakeHevy) -> None:
    # Hevy lists events newest first: this workout was edited, then deleted.
    syncer.sync()
    workout = hevy.workouts[0]
    hevy.events = [deleted(workout["id"]), updated(workout)]
    syncer.sync()
    assert workout["id"] not in {w.id for w in syncer.store.workouts()}


def test_refetches_templates_only_for_unknown_exercises(syncer: Syncer, hevy: FakeHevy) -> None:
    syncer.sync()

    hevy.calls.clear()
    hevy.events = [updated(hevy.workouts[0])]
    syncer.sync()
    assert "templates" not in hevy.calls

    custom = {**hevy.templates[0], "id": "T-CUSTOM", "title": "My Custom Exercise"}
    hevy.templates = [*hevy.templates, custom]
    workout = {**hevy.workouts[0]}
    workout["exercises"] = [{**workout["exercises"][0], "exercise_template_id": "T-CUSTOM"}]
    hevy.events = [updated(workout)]
    hevy.calls.clear()
    syncer.sync()
    assert "templates" in hevy.calls
    assert "T-CUSTOM" in {t.id for t in syncer.store.templates()}


def test_failed_sync_keeps_existing_data(syncer: Syncer, hevy: FakeHevy) -> None:
    syncer.sync()
    hevy.fail = True
    with pytest.raises(ConnectionError):
        syncer.sync()
    assert len(syncer.store.workouts()) == len(hevy.workouts)
    assert syncer.store.synced_at() == T0


# --- Refresher -------------------------------------------------------------------------


def wait_for_background(refresher: Refresher) -> None:
    # The background refresh holds the lock while it runs.
    with refresher._lock:
        pass


def test_first_request_waits_for_the_first_sync(syncer: Syncer) -> None:
    refresher = Refresher(syncer, now=syncer.now)
    refresher.ensure_fresh()
    assert syncer.store.synced_at() is not None


def test_fresh_data_is_not_refreshed(syncer: Syncer, hevy: FakeHevy, clock: Clock) -> None:
    refresher = Refresher(syncer, now=clock)
    refresher.ensure_fresh()
    hevy.calls.clear()
    clock.advance(MAX_AGE)
    refresher.ensure_fresh()
    assert hevy.calls == []


def test_stale_data_is_refreshed_in_the_background(
    syncer: Syncer, hevy: FakeHevy, clock: Clock
) -> None:
    refresher = Refresher(syncer, now=clock)
    refresher.ensure_fresh()
    clock.advance(MAX_AGE + timedelta(seconds=1))
    refresher.ensure_fresh()
    wait_for_background(refresher)
    assert syncer.store.synced_at() == clock.time


def test_only_one_refresh_runs_however_many_requests_arrive(
    syncer: Syncer, hevy: FakeHevy, clock: Clock
) -> None:
    refresher = Refresher(syncer, now=clock)
    refresher.ensure_fresh()
    clock.advance(MAX_AGE * 2)

    # Hold the first background refresh open while more requests come in.
    release = threading.Event()
    original = hevy.get_workout_events

    def slow_events(since: str) -> list[JSON]:
        release.wait(timeout=5)
        return original(since)

    hevy.get_workout_events = slow_events  # type: ignore[method-assign]
    hevy.calls.clear()
    for _ in range(20):
        refresher.ensure_fresh()
    assert refresher.status().refreshing
    release.set()
    wait_for_background(refresher)

    assert sum(call.startswith("events") for call in hevy.calls) == 1


def test_failures_are_reported_and_retried_after_a_pause(
    syncer: Syncer, hevy: FakeHevy, clock: Clock
) -> None:
    refresher = Refresher(syncer, now=clock)
    refresher.ensure_fresh()
    hevy.fail = True
    clock.advance(MAX_AGE * 2)

    refresher.ensure_fresh()
    wait_for_background(refresher)
    assert refresher.status().last_error == "Hevy is down"
    assert syncer.store.workouts() != []  # still serving the stored copy

    hevy.calls.clear()
    refresher.ensure_fresh()  # too soon to retry
    wait_for_background(refresher)
    assert hevy.calls == []

    hevy.fail = False
    clock.advance(RETRY_AFTER)
    refresher.ensure_fresh()
    wait_for_background(refresher)
    assert refresher.status().last_error is None
    assert syncer.store.synced_at() == clock.time


def test_a_failed_first_sync_leaves_the_store_empty_and_reports_why(
    syncer: Syncer, hevy: FakeHevy
) -> None:
    hevy.fail = True
    refresher = Refresher(syncer, now=syncer.now)
    refresher.ensure_fresh()
    assert syncer.store.synced_at() is None
    assert refresher.status().last_error == "Hevy is down"
