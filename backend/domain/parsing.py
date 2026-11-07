"""
Converts raw Hevy API JSON into the domain models.

This is where the privacy rule "drop notes, descriptions and times of day" is
applied: those fields are simply never copied across.
"""

from datetime import datetime
from typing import Any

from backend.domain.models import ExerciseTemplate, LoggedSet, PerformedExercise, Routine, Workout

JSON = dict[str, Any]


def parse_template(raw: JSON) -> ExerciseTemplate:
    return ExerciseTemplate(
        id=raw["id"],
        title=raw["title"],
        type=raw["type"],
        primary_muscle_group=raw["primary_muscle_group"],
        secondary_muscle_groups=tuple(raw.get("secondary_muscle_groups") or ()),
        equipment=raw.get("equipment") or "other",
    )


def parse_set(raw: JSON) -> LoggedSet:
    return LoggedSet(
        is_warmup=raw.get("type") == "warmup",
        weight_kg=raw.get("weight_kg"),
        reps=raw.get("reps"),
        duration_seconds=raw.get("duration_seconds"),
    )


def parse_workout(raw: JSON) -> Workout:
    start = datetime.fromisoformat(raw["start_time"])
    return Workout(
        id=raw["id"],
        # Calendar date only. Hevy timestamps are UTC, so a session logged
        # just after midnight UTC lands on the next day.
        date=start.date(),
        duration_minutes=_duration_minutes(start, raw.get("end_time")),
        routine_id=raw.get("routine_id"),
        exercises=tuple(
            PerformedExercise(
                template_id=ex["exercise_template_id"],
                sets=tuple(parse_set(s) for s in ex["sets"]),
            )
            for ex in raw["exercises"]
        ),
    )


def _duration_minutes(start: datetime, end_time: str | None) -> int | None:
    """How long the workout lasted, in whole minutes; None if Hevy didn't say."""
    if not end_time:
        return None
    seconds = (datetime.fromisoformat(end_time) - start).total_seconds()
    return round(seconds / 60) if seconds > 0 else None


def parse_routine(raw: JSON) -> Routine:
    return Routine(
        id=raw["id"],
        title=raw["title"],
        template_ids=tuple(ex["exercise_template_id"] for ex in raw["exercises"]),
    )
