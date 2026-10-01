"""
Connects the stored data to the API: loads it, runs the progress rules, and keeps
the results until the data changes, so they aren't recalculated on every request.
"""

import os
import threading
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path

from backend.domain.models import ExerciseTemplate
from backend.domain.progress import (
    ExerciseProgress,
    MuscleGroupSummary,
    analyse_all,
    muscle_group_summaries,
)
from backend.store import Store
from backend.sync import Refresher, Status, Syncer

DEFAULT_DATABASE_PATH = Path("data/hevy.db")


@dataclass(frozen=True)
class Snapshot:
    """Everything the API serves, worked out from one version of the stored data."""

    synced_at: datetime
    templates: dict[str, ExerciseTemplate]
    progress: dict[str, ExerciseProgress]  # only exercises that have been performed
    muscles: dict[str, MuscleGroupSummary]


class ProgressService:
    def __init__(self, store: Store, refresher: Refresher, today: Callable[[], date] = date.today):
        self.store = store
        self.refresher = refresher
        self.today = today
        self._cached: Snapshot | None = None
        self._lock = threading.Lock()

    @classmethod
    def from_env(cls) -> "ProgressService":
        from backend.hevy_client import HevyClient

        store = Store(Path(os.environ.get("DATABASE_PATH", DEFAULT_DATABASE_PATH)))
        return cls(store, Refresher(Syncer(HevyClient(), store)))

    def snapshot(self) -> Snapshot | None:
        """The latest data, refreshing from Hevy first if it's stale. None if there's
        no data yet (the first sync hasn't succeeded)."""
        self.refresher.ensure_fresh()
        synced_at = self.store.synced_at()
        if synced_at is None:
            return None
        with self._lock:
            if self._cached is None or self._cached.synced_at != synced_at:
                self._cached = self._build(synced_at)
            return self._cached

    def status(self) -> Status:
        return self.refresher.status()

    def _build(self, synced_at: datetime) -> Snapshot:
        templates = {t.id: t for t in self.store.templates()}
        progress = analyse_all(templates.values(), self.store.workouts())
        muscles = {m.group: m for m in muscle_group_summaries(progress.values())}
        return Snapshot(synced_at, templates, progress, muscles)
