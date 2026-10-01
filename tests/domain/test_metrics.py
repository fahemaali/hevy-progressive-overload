import pytest

from backend.domain.metrics import (
    RepRange,
    TrackingMode,
    epley_e1rm,
    rep_range,
    tracking_mode,
    weight_increment,
)
from tests.domain.helpers import template


@pytest.mark.parametrize(
    ("weight", "reps", "expected"),
    [
        (100, 1, 103.33),
        (60, 5, 70.0),
        (40, 20, 66.67),
        (0, 10, 0.0),
    ],
)
def test_epley(weight: float, reps: int, expected: float) -> None:
    assert epley_e1rm(weight, reps) == pytest.approx(expected, abs=0.01)


@pytest.mark.parametrize(
    ("reps", "expected"),
    [
        (1, RepRange.STRENGTH),
        (12, RepRange.STRENGTH),
        (13, RepRange.HIGH_REP),
        (30, RepRange.HIGH_REP),
    ],
)
def test_rep_range_boundary_is_12(reps: int, expected: RepRange) -> None:
    assert rep_range(reps) is expected


@pytest.mark.parametrize(
    ("hevy_type", "expected"),
    [
        ("weight_reps", TrackingMode.LOAD),
        ("bodyweight_weighted", TrackingMode.LOAD),
        ("reps_only", TrackingMode.REPS),
        ("bodyweight_assisted", TrackingMode.ASSISTED),
        ("duration", TrackingMode.DURATION),
        ("distance_duration", TrackingMode.UNTRACKED),
        ("steps_duration", TrackingMode.UNTRACKED),
        ("some_future_type", TrackingMode.UNTRACKED),
    ],
)
def test_tracking_mode_by_hevy_type(hevy_type: str, expected: TrackingMode) -> None:
    assert tracking_mode(template(type_=hevy_type)) is expected


@pytest.mark.parametrize(
    ("equipment", "expected"),
    [("barbell", 2.5), ("dumbbell", 2.0), ("machine", 5.0), ("kettlebell", 2.5), ("other", 2.5)],
)
def test_weight_increment(equipment: str, expected: float) -> None:
    assert weight_increment(equipment) == expected
