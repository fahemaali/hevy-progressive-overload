"""Building blocks: how each exercise type is measured, rep ranges, e1RM and weight increments."""

from enum import StrEnum

from backend.domain.models import ExerciseTemplate


class TrackingMode(StrEnum):
    """What 'progress' means for an exercise, derived from its Hevy type."""

    LOAD = "load"  # weight × reps → e1RM
    REPS = "reps"  # bodyweight reps only
    ASSISTED = "assisted"  # assistance weight, where less is better
    DURATION = "duration"  # longest hold
    UNTRACKED = "untracked"  # distance, floors, steps…: not measured


TRACKING_BY_TYPE = {
    "weight_reps": TrackingMode.LOAD,
    "bodyweight_weighted": TrackingMode.LOAD,  # the logged weight is the added load
    "reps_only": TrackingMode.REPS,
    "bodyweight_assisted": TrackingMode.ASSISTED,
    "duration": TrackingMode.DURATION,
}


def tracking_mode(template: ExerciseTemplate) -> TrackingMode:
    return TRACKING_BY_TYPE.get(template.type, TrackingMode.UNTRACKED)


class RepRange(StrEnum):
    """Each exercise is tracked as two progressions (see REQUIREMENTS.md)."""

    STRENGTH = "strength"
    LIGHT = "light"


STRENGTH_MAX_REPS = 12

# The reps the plan aims for in each range: (bottom, top).
PLAN_REPS: dict[RepRange, tuple[int, int]] = {
    RepRange.STRENGTH: (8, 12),
    RepRange.LIGHT: (15, 20),
}


def rep_range(reps: int) -> RepRange:
    return RepRange.STRENGTH if reps <= STRENGTH_MAX_REPS else RepRange.LIGHT


def epley_e1rm(weight_kg: float, reps: int) -> float:
    """Estimated one-rep max (Epley): weight × (1 + reps / 30)."""
    return weight_kg * (1 + reps / 30)


DEFAULT_INCREMENT_KG = 2.5
INCREMENT_BY_EQUIPMENT_KG = {"barbell": 2.5, "dumbbell": 2.0, "machine": 5.0}


def weight_increment(equipment: str) -> float:
    return INCREMENT_BY_EQUIPMENT_KG.get(equipment, DEFAULT_INCREMENT_KG)
