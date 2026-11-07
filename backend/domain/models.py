"""
The app's own view of Hevy data: only the fields the rules need.

Notes, descriptions and times of day have no field here, so once data is
parsed into these models it cannot leak them. (A workout's length is kept, but
not when it started or ended.)
"""

from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class ExerciseTemplate:
    id: str
    title: str
    type: str  # Hevy's exercise type, e.g. "weight_reps", "duration"
    primary_muscle_group: str
    secondary_muscle_groups: tuple[str, ...]
    equipment: str


@dataclass(frozen=True)
class LoggedSet:
    is_warmup: bool
    weight_kg: float | None
    reps: int | None
    duration_seconds: int | None


@dataclass(frozen=True)
class PerformedExercise:
    template_id: str
    sets: tuple[LoggedSet, ...]


@dataclass(frozen=True)
class Workout:
    id: str
    date: date
    routine_id: str | None
    exercises: tuple[PerformedExercise, ...]
    # How long the workout lasted (end minus start). Only used to judge how much fits in
    # a session; the start and end times themselves are never kept.
    duration_minutes: int | None = None


@dataclass(frozen=True)
class Routine:
    id: str
    title: str
    template_ids: tuple[str, ...]
