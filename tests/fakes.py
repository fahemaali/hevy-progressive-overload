"""Test doubles shared by the sync and API tests."""

from datetime import UTC, datetime, timedelta
from typing import Any

T0 = datetime(2026, 7, 1, 12, 0, tzinfo=UTC)
JSON = dict[str, Any]


class FakeHevy:
    """Serves fixture data and records which calls were made."""

    def __init__(self, workouts: list[JSON], templates: list[JSON], routines: list[JSON]):
        self.workouts = workouts
        self.templates = templates
        self.routines = routines
        self.events: list[JSON] = []
        self.calls: list[str] = []
        self.fail = False

    def _record(self, name: str) -> None:
        self.calls.append(name)
        if self.fail:
            raise ConnectionError("Hevy is down")

    def get_all_workouts(self) -> list[JSON]:
        self._record("workouts")
        return self.workouts

    def get_workout_events(self, since: str) -> list[JSON]:
        self._record(f"events since {since}")
        return self.events

    def get_all_exercise_templates(self) -> list[JSON]:
        self._record("templates")
        return self.templates

    def get_all_routines(self) -> list[JSON]:
        self._record("routines")
        return self.routines


class Clock:
    def __init__(self, start: datetime = T0):
        self.time = start

    def __call__(self) -> datetime:
        return self.time

    def advance(self, by: timedelta) -> None:
        self.time += by
