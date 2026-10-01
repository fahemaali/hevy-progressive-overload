import pytest

from backend.domain.metrics import RepRange
from backend.domain.sessions import summarise_sessions
from tests.domain.helpers import hold, lift, template, workout


def test_warmup_sets_are_excluded() -> None:
    [summary] = summarise_sessions(
        template(), [workout(0, lift(20, 10, warmup=True), lift(50, 8), lift(50, 8))]
    )
    assert summary.set_count == 2
    assert summary.total_reps == 16
    assert summary.volume_kg == 800


def test_top_set_is_the_best_e1rm_not_the_heaviest() -> None:
    # 50 × 10 (e1RM 66.7) beats 55 × 5 (e1RM 64.2)
    [summary] = summarise_sessions(template(), [workout(0, lift(55, 5), lift(50, 10))])
    assert (summary.top_set.weight_kg, summary.top_set.reps) == (50, 10)
    assert summary.score == pytest.approx(66.67, abs=0.01)


def test_heavy_and_light_sets_in_one_session_are_summarised_separately() -> None:
    summaries = summarise_sessions(template(), [workout(0, lift(60, 6), lift(30, 20))])
    by_range = {s.rep_range: s for s in summaries}
    assert set(by_range) == {RepRange.STRENGTH, RepRange.LIGHT}
    assert by_range[RepRange.STRENGTH].top_set.weight_kg == 60
    assert by_range[RepRange.LIGHT].top_set.weight_kg == 30


def test_weighted_sets_without_weight_or_reps_are_ignored() -> None:
    assert summarise_sessions(template(), [workout(0, lift(None, 10), lift(50, None))]) == []


def test_sessions_are_oldest_first_and_other_exercises_ignored() -> None:
    workouts = [
        workout(14, lift(52.5, 8)),
        workout(0, lift(50, 8)),
        workout(7, lift(99, 1), template_id="OTHER"),
    ]
    summaries = summarise_sessions(template(), workouts)
    assert [s.workout_id for s in summaries] == ["W0", "W14"]


def test_reps_only_scores_best_set() -> None:
    [summary] = summarise_sessions(
        template(type_="reps_only"), [workout(0, lift(None, 12), lift(None, 15))]
    )
    assert summary.score == 15
    assert summary.rep_range is None
    assert summary.volume_kg == 0


def test_assisted_scores_least_assistance_then_most_reps() -> None:
    [summary] = summarise_sessions(
        template(type_="bodyweight_assisted"),
        [workout(0, lift(30, 10), lift(25, 6), lift(25, 8))],
    )
    assert summary.score == 25
    assert summary.top_set.reps == 8
    assert summary.working_weight_kg == 25  # least assistance is the working weight
    assert summary.working_reps == (6, 8)


def test_working_weight_is_heaviest_and_working_reps_cover_every_set_at_it() -> None:
    [summary] = summarise_sessions(
        template(), [workout(0, lift(40, 12), lift(50, 10), lift(50, 8), lift(50, 9))]
    )
    assert summary.working_weight_kg == 50
    assert summary.working_reps == (10, 8, 9)


def test_duration_scores_longest_hold() -> None:
    [summary] = summarise_sessions(template(type_="duration"), [workout(0, hold(45), hold(60))])
    assert summary.score == 60


def test_untracked_types_produce_no_summaries() -> None:
    assert summarise_sessions(template(type_="distance_duration"), [workout(0, hold(600))]) == []
