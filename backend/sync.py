"""
Keeps the local store up to date with Hevy.

Run a sync by hand with:  python -m backend.sync
"""

import logging
import threading
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Protocol

from backend.domain.parsing import parse_routine, parse_template, parse_workout
from backend.store import Store

log = logging.getLogger(__name__)

JSON = dict[str, Any]

# Ask for changes from a little before the last sync, in case clocks differ.
# Re-applying a change is harmless.
SYNC_OVERLAP = timedelta(minutes=5)
# Data older than this is refreshed in the background on the next request.
MAX_AGE = timedelta(minutes=15)
# After a failed refresh, wait this long before trying again.
RETRY_AFTER = timedelta(minutes=1)


class HevySource(Protocol):
    """The parts of HevyClient the sync uses (a fake stands in for it in tests)."""

    def get_all_workouts(self) -> list[JSON]: ...
    def get_workout_events(self, since: str) -> list[JSON]: ...
    def get_all_exercise_templates(self) -> list[JSON]: ...
    def get_all_routines(self) -> list[JSON]: ...


def utc_now() -> datetime:
    return datetime.now(UTC)


@dataclass(frozen=True)
class SyncResult:
    full: bool
    updated: int
    deleted: int


class Syncer:
    """Copies Hevy data into the store: everything the first time, then only changes."""

    def __init__(self, source: HevySource, store: Store, now: Callable[[], datetime] = utc_now):
        self.source = source
        self.store = store
        self.now = now

    def sync(self) -> SyncResult:
        # Recorded before fetching, so changes made during the sync are picked up next time.
        started = self.now()
        last = self.store.synced_at()
        return self._full(started) if last is None else self._incremental(started, last)

    def _full(self, started: datetime) -> SyncResult:
        templates = [parse_template(t) for t in self.source.get_all_exercise_templates()]
        routines = [parse_routine(r) for r in self.source.get_all_routines()]
        workouts = [parse_workout(w) for w in self.source.get_all_workouts()]
        self.store.save(started, templates=templates, routines=routines, all_workouts=workouts)
        return SyncResult(full=True, updated=len(workouts), deleted=0)

    def _incremental(self, started: datetime, last: datetime) -> SyncResult:
        events = self.source.get_workout_events(since=(last - SYNC_OVERLAP).isoformat())

        # Hevy lists events newest first; only the latest event per workout matters
        # (e.g. edited, then deleted).
        latest: dict[str, JSON] = {}
        for event in events:
            workout_id = event["workout"]["id"] if event["type"] == "updated" else event.get("id")
            if workout_id and workout_id not in latest:
                latest[workout_id] = event

        updated = [parse_workout(e["workout"]) for e in latest.values() if e["type"] == "updated"]
        deleted = [i for i, e in latest.items() if e["type"] == "deleted"]

        # Templates rarely change; refetch them only when a workout uses one we don't know
        # (e.g. a newly created custom exercise).
        known = {t.id for t in self.store.templates()}
        new_template = any(ex.template_id not in known for w in updated for ex in w.exercises)
        templates = (
            [parse_template(t) for t in self.source.get_all_exercise_templates()]
            if new_template
            else None
        )
        routines = [parse_routine(r) for r in self.source.get_all_routines()]

        self.store.save(
            started,
            templates=templates,
            routines=routines,
            upsert_workouts=updated,
            delete_workout_ids=deleted,
        )
        return SyncResult(full=False, updated=len(updated), deleted=len(deleted))


@dataclass(frozen=True)
class Status:
    synced_at: datetime | None
    refreshing: bool
    last_error: str | None  # set while the latest refresh attempt has failed


class Refresher:
    """Serves the stored copy straight away and refreshes it in the background once it's
    older than MAX_AGE. At most one refresh runs at a time, however many requests arrive,
    so visitors never cause one call to Hevy each."""

    def __init__(
        self,
        syncer: Syncer,
        max_age: timedelta = MAX_AGE,
        now: Callable[[], datetime] = utc_now,
    ):
        self.syncer = syncer
        self.max_age = max_age
        self.now = now
        self._lock = threading.Lock()
        self._last_attempt: datetime | None = None
        self._last_error: str | None = None

    def ensure_fresh(self) -> None:
        """Call before reading the store."""
        synced_at = self.syncer.store.synced_at()
        if synced_at is None:
            # Nothing stored yet (first run, or the host lost its disk): wait for it.
            with self._lock:
                if self.syncer.store.synced_at() is None and self._may_retry():
                    self._sync()
        elif self.now() - synced_at > self.max_age and self._may_retry():
            self._refresh_in_background()

    def status(self) -> Status:
        return Status(
            synced_at=self.syncer.store.synced_at(),
            refreshing=self._lock.locked(),
            last_error=self._last_error,
        )

    def _may_retry(self) -> bool:
        return self._last_attempt is None or self.now() - self._last_attempt >= RETRY_AFTER

    def _refresh_in_background(self) -> None:
        if not self._lock.acquire(blocking=False):
            return  # a refresh is already running
        thread = threading.Thread(target=self._sync_and_release, daemon=True)
        thread.start()

    def _sync_and_release(self) -> None:
        try:
            self._sync()
        finally:
            self._lock.release()

    def _sync(self) -> None:
        self._last_attempt = self.now()
        try:
            result = self.syncer.sync()
        except Exception as err:  # never let a failed refresh take the app down
            log.exception("Sync with Hevy failed")
            self._last_error = str(err)
            return
        self._last_error = None
        log.info("Synced with Hevy: %s", result)


def main() -> None:
    import os
    from pathlib import Path

    from dotenv import load_dotenv

    from backend.hevy_client import HevyClient

    load_dotenv()
    logging.basicConfig(level=logging.INFO)
    store = Store(Path(os.environ.get("DATABASE_PATH", "data/hevy.db")))
    result = Syncer(HevyClient(), store).sync()
    print(
        f"{'Full' if result.full else 'Incremental'} sync: {result.updated} workouts updated, "
        f"{result.deleted} deleted."
    )


if __name__ == "__main__":
    main()
