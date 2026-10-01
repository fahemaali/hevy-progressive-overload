"""End-to-end over the synthetic fixtures, plus the muscle-group rules."""

from collections.abc import Sequence
from datetime import date, timedelta
from typing import Any

import pytest

from backend.domain.metrics import RepRange
from backend.domain.parsing import parse_template, parse_workout
from backend.domain.progress import (
    ExerciseProgress,
    MuscleGroupSummary,
    analyse_all,
    analyse_exercise,
    muscle_group_summaries,
)
from backend.domain.verdicts import Trend
from tests.domain.helpers import lift, template, workout

LAST_FIXTURE_WEEK = date(2026, 7, 20)


@pytest.fixture
def progress(
    exercise_templates: list[dict[str, Any]], workouts: list[dict[str, Any]]
) -> dict[str, ExerciseProgress]:
    return analyse_all(
        [parse_template(t) for t in exercise_templates], [parse_workout(w) for w in workouts]
    )


@pytest.fixture
def groups(progress: dict[str, ExerciseProgress]) -> dict[str, MuscleGroupSummary]:
    return {g.group: g for g in muscle_group_summaries(progress.values())}


@pytest.mark.parametrize(
    ("template_id", "trend", "is_best"),
    [
        ("T-BENCH", Trend.DOWN, False),  # 52.5 × 7 after three sessions around 55 × 8
        ("T-CHESTPRESS", Trend.UP, True),  # latest light session beats earlier light ones
        ("T-PUSHUP", Trend.UP, True),
        ("T-PLANK", Trend.UP, True),
        ("T-PULLDOWN", Trend.FLAT, False),
        ("T-ASSISTPULLUP", Trend.UP, False),  # less assistance, but matches an earlier best
    ],
)
def test_fixture_latest_results(
    progress: dict[str, ExerciseProgress], template_id: str, trend: Trend, is_best: bool
) -> None:
    latest = progress[template_id].latest
    assert latest is not None
    assert (latest.trend, latest.is_best) == (trend, is_best)


def test_untracked_exercise_has_no_results(progress: dict[str, ExerciseProgress]) -> None:
    assert progress["T-TREADMILL"].latest is None


def test_fixture_muscle_weeks(groups: dict[str, MuscleGroupSummary]) -> None:
    chest = groups["chest"]
    assert chest.weeks[0].trend is Trend.INSUFFICIENT  # first week: everything is new
    assert chest.current is not None
    assert chest.current.week_start == LAST_FIXTURE_WEEK
    assert chest.current.trend is Trend.UP  # 2 of 3 primary exercises progressing

    # Lats: pulldown not progressing, assisted pull-up progressing: no majority.
    assert groups["lats"].current is not None
    assert groups["lats"].current.trend is Trend.FLAT

    # Triceps are only ever trained indirectly: listed, but not tracked.
    triceps = groups["triceps"]
    assert not triceps.trained_directly
    assert triceps.current is None
    assert len(triceps.strength) == 3  # bench, chest press, push-ups

    assert "cardio" not in groups  # no place on a body map


def test_fixture_strength_list(groups: dict[str, MuscleGroupSummary]) -> None:
    chest = groups["chest"]
    titles = [e.exercise.template.title for e in chest.strength]
    assert titles[:3] == ["Bench Press (Barbell)", "Chest Press (Machine)", "Push Up"]

    bench = chest.strength[0]
    assert (bench.latest.top_set.weight_kg, bench.latest.top_set.reps) == (52.5, 7)
    assert (bench.best.top_set.weight_kg, bench.best.top_set.reps) == (55, 9)

    assisted = next(e for e in groups["lats"].strength if e.exercise.mode == "assisted")
    assert assisted.best.top_set.weight_kg == 22.5  # least assistance is best


# --- Weekly roll-up rules ------------------------------------------------------------

UP, FLAT, DOWN, NEW = [100, 110], [100, 100], [100, 90], [100]


def exercise(weights: Sequence[float], id_: str, primary: str = "biceps") -> ExerciseProgress:
    """Weekly sessions at the given weights, timed so every exercise's last session
    falls in the same week."""
    secondary = () if primary == "biceps" else ("biceps",)
    first_week = 2 - len(weights)
    workouts = [
        workout(7 * (first_week + i), lift(w, 5), template_id=id_) for i, w in enumerate(weights)
    ]
    return analyse_exercise(template(primary=primary, secondary=secondary, id_=id_), workouts)


@pytest.mark.parametrize(
    ("primary", "secondary", "expected"),
    [
        ([UP], [], Trend.UP),
        ([UP, UP, DOWN], [], Trend.UP),
        ([UP, FLAT], [], Trend.FLAT),
        ([UP, DOWN], [], Trend.FLAT),
        ([DOWN, DOWN, UP], [], Trend.DOWN),
        ([NEW], [], Trend.INSUFFICIENT),  # new exercises don't count yet
        ([NEW, UP], [], Trend.UP),
        # Secondary exercises count half: 1 up vs 2 × 0.5 down is a tie → not progressing…
        ([UP], [DOWN, DOWN], Trend.FLAT),
        # …but 1 up vs 1 × 0.5 down is still a majority.
        ([UP], [DOWN], Trend.UP),
        ([], [UP], Trend.INSUFFICIENT),  # indirect-only weeks aren't judged
        ([NEW], [UP], Trend.UP),  # trained directly (new), so indirect work counts
    ],
)
def test_weekly_roll_up(
    primary: list[Sequence[float]], secondary: list[Sequence[float]], expected: Trend
) -> None:
    exercises = [exercise(w, f"P{i}") for i, w in enumerate(primary)]
    exercises += [exercise(w, f"S{i}", primary="lats") for i, w in enumerate(secondary)]
    biceps = next(g for g in muscle_group_summaries(exercises) if g.group == "biceps")
    assert biceps.weeks[-1].trend is expected


def test_current_skips_weeks_that_cannot_be_judged() -> None:
    # Weeks 0–1: a curl progresses. Week 2: only a brand-new exercise.
    curl = analyse_exercise(
        template(primary="biceps", id_="A"),
        [workout(0, lift(10, 8), template_id="A"), workout(7, lift(11, 8), template_id="A")],
    )
    brand_new = analyse_exercise(
        template(primary="biceps", id_="B"), [workout(14, lift(20, 8), template_id="B")]
    )
    [biceps] = muscle_group_summaries([curl, brand_new])
    assert biceps.weeks[-1].trend is Trend.INSUFFICIENT
    assert biceps.current is not None
    assert biceps.current.trend is Trend.UP


def test_stale_after_three_weeks_without_direct_training() -> None:
    [biceps] = muscle_group_summaries([exercise(UP, "A")])
    last = biceps.last_trained_directly
    assert last is not None
    assert not biceps.is_stale(last + timedelta(weeks=3))
    assert biceps.is_stale(last + timedelta(weeks=3, days=1))


def test_non_body_groups_are_left_off_the_map() -> None:
    full_body = analyse_exercise(
        template(primary="full_body", id_="F"), [workout(0, lift(20, 10), template_id="F")]
    )
    assert muscle_group_summaries([full_body]) == []


def test_default_range_prefers_strength() -> None:
    light_only = analyse_exercise(template(), [workout(0, lift(20, 15))])
    both = analyse_exercise(template(), [workout(0, lift(20, 15)), workout(7, lift(40, 8))])
    assert light_only.default_range is not None
    assert light_only.default_range.rep_range is RepRange.LIGHT
    assert both.default_range is not None
    assert both.default_range.rep_range is RepRange.STRENGTH


def test_muscle_change_is_weighted_and_capped() -> None:
    # Primary +10%, secondary +200% (capped to +25%, counted half): (10 + 12.5) / 1.5 = 15
    primary = exercise([100, 110], "P")
    huge = exercise([10, 30], "S", primary="lats")
    [biceps] = [g for g in muscle_group_summaries([primary, huge]) if g.group == "biceps"]
    assert biceps.current is not None
    assert biceps.current.change_pct == 15.0


def test_muscle_change_is_none_for_weeks_that_cannot_be_judged() -> None:
    [biceps] = muscle_group_summaries([exercise([100], "P")])
    assert biceps.weeks[-1].change_pct is None


def test_assisted_change_counts_less_assistance_as_positive() -> None:
    t = template(type_="bodyweight_assisted", primary="lats", id_="A")
    assisted = analyse_exercise(
        t, [workout(0, lift(30, 8), template_id="A"), workout(7, lift(27, 8), template_id="A")]
    )
    [lats] = muscle_group_summaries([assisted])
    assert lats.current is not None
    assert lats.current.change_pct == 10.0
