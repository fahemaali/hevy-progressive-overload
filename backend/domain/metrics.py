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
    """Weighted sets are compared only with sets in the same range (see REQUIREMENTS.md)."""

    STRENGTH = "strength"
    HIGH_REP = "high_rep"


STRENGTH_MAX_REPS = 12

REP_RANGE_LABELS = {RepRange.STRENGTH: "Strength", RepRange.HIGH_REP: "High-rep"}

# (min reps, max reps or None for no upper limit)
REP_RANGE_BOUNDS: dict[RepRange, tuple[int, int | None]] = {
    RepRange.STRENGTH: (1, STRENGTH_MAX_REPS),
    RepRange.HIGH_REP: (STRENGTH_MAX_REPS + 1, None),
}


def rep_range(reps: int) -> RepRange:
    return RepRange.STRENGTH if reps <= STRENGTH_MAX_REPS else RepRange.HIGH_REP


def epley_e1rm(weight_kg: float, reps: int) -> float:
    """Estimated one-rep max (Epley): weight × (1 + reps / 30)."""
    return weight_kg * (1 + reps / 30)


DEFAULT_INCREMENT_KG = 2.5
INCREMENT_BY_EQUIPMENT_KG = {"barbell": 2.5, "dumbbell": 2.0, "machine": 5.0}


def weight_increment(equipment: str) -> float:
    return INCREMENT_BY_EQUIPMENT_KG.get(equipment, DEFAULT_INCREMENT_KG)
