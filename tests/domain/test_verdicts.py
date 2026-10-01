from collections.abc import Sequence

import pytest

from backend.domain.metrics import RepRange, tracking_mode
from backend.domain.models import ExerciseTemplate, Workout
from backend.domain.sessions import summarise_sessions
from backend.domain.verdicts import SessionResult, Trend, judge_sessions
from tests.domain.helpers import hold, lift, template, weekly


def results_for(t: ExerciseTemplate, workouts: list[Workout]) -> list[SessionResult]:
    return judge_sessions(tracking_mode(t), summarise_sessions(t, workouts))


def latest_for(t: ExerciseTemplate, workouts: list[Workout]) -> SessionResult:
    return results_for(t, workouts)[-1]


def lifts(weights: Sequence[float], reps: int = 5) -> list[Workout]:
    """One session per week at the given weights, same reps throughout so the
    e1RM change equals the weight change."""
    return weekly(*[(lift(w, reps),) for w in weights])


@pytest.mark.parametrize(
    ("latest_weight", "expected"),
    [
        (110, Trend.UP),  # +10%
        (102.5, Trend.UP),  # +2.5%
        (102, Trend.FLAT),  # +2% exactly: still within the band
        (100, Trend.FLAT),
        (98, Trend.FLAT),  # −2% exactly
        (97.5, Trend.DOWN),
        (90, Trend.DOWN),
    ],
)
def test_trend_thresholds(latest_weight: float, expected: Trend) -> None:
    assert latest_for(template(), lifts([100, 100, 100, latest_weight])).trend is expected


def test_first_session_sets_the_baseline() -> None:
    [first] = results_for(template(), lifts([100]))
    assert first.trend is Trend.NEW
    assert first.reason == "First Strength e1RM session: sets the baseline"


def test_judged_from_the_second_session() -> None:
    second = latest_for(template(), lifts([100, 105]))
    assert second.trend is Trend.UP
    assert second.change_pct == 5.0


def test_recent_level_is_median_of_last_three_earlier_sessions() -> None:
    # 50 kg is outside the last three; the median (100) ignores the 120 kg outlier.
    result = latest_for(template(), lifts([50, 95, 100, 120, 100]))
    assert result.trend is Trend.FLAT
    assert result.change_pct == 0


def test_every_session_is_judged_against_only_what_came_before() -> None:
    trends = [r.trend for r in results_for(template(), lifts([100, 110, 100, 90]))]
    # 110 vs 100 ▲; 100 vs median(100, 110) = 105 ▼; 90 vs median(100, 110, 100) = 100 ▼
    assert trends == [Trend.NEW, Trend.UP, Trend.DOWN, Trend.DOWN]


# --- Best ever ----------------------------------------------------------------------


def test_new_best_is_flagged() -> None:
    result = latest_for(template(), lifts([100, 100, 100, 110]))
    assert result.is_best
    assert result.off_best_pct is None
    assert result.reason == "Strength e1RM up 10.0% vs your recent level · new best"


def test_shows_how_far_off_an_earlier_best() -> None:
    # Best was 120 a while ago; recent level is 100, so 104 is progress but 13.3% off the best.
    result = latest_for(template(), lifts([120, 100, 100, 100, 104]))
    assert result.trend is Trend.UP
    assert not result.is_best
    assert result.off_best_pct == 13.3
    assert result.reason == "Strength e1RM up 4.0% vs your recent level · 13.3% off your best"


def test_matching_best_is_not_a_new_best() -> None:
    result = latest_for(template(), lifts([100, 100]))
    assert not result.is_best
    assert result.off_best_pct == 0
    assert result.reason == "Strength e1RM unchanged vs your recent level"


# --- Rep ranges and exercise types -------------------------------------------------


def test_light_sessions_are_only_compared_with_light_sessions() -> None:
    # Alternating heavy and light weeks. By e1RM alone, the latest light session
    # (25 × 20 = 41.7) would look like a big drop from the heavy ones (60 × 8 = 76).
    heavy, light = (lift(60, 8),), (lift(25, 20),)
    result = latest_for(template(), weekly(heavy, light, heavy, light))
    assert result.session.rep_range is RepRange.HIGH_REP
    assert result.trend is Trend.FLAT


def test_less_assistance_is_progress_and_a_best() -> None:
    sessions = weekly(*[(lift(w, 8),) for w in (25, 25, 25, 22.5)])
    result = latest_for(template(type_="bodyweight_assisted"), sessions)
    assert result.trend is Trend.UP
    assert result.is_best
    assert result.reason == "Assistance down 10.0% vs your recent level · new best"


def test_more_assistance_is_decline() -> None:
    sessions = weekly(*[(lift(w, 8),) for w in (20, 20, 20, 25)])
    result = latest_for(template(type_="bodyweight_assisted"), sessions)
    assert result.trend is Trend.DOWN
    assert result.off_best_pct == 25.0


@pytest.mark.parametrize(("latest", "expected"), [(0, Trend.FLAT), (10, Trend.DOWN)])
def test_assisted_from_zero_assistance(latest: float, expected: Trend) -> None:
    sessions = weekly(*[(lift(w, 8),) for w in (0, 0, 0, latest)])
    assert latest_for(template(type_="bodyweight_assisted"), sessions).trend is expected


def test_reps_only_and_duration() -> None:
    reps = weekly(*[(lift(None, r),) for r in (10, 10, 10, 12)])
    assert latest_for(template(type_="reps_only"), reps).reason == (
        "Best set up 20.0% vs your recent level · new best"
    )
    holds = weekly(*[(hold(s),) for s in (60, 60, 60, 50)])
    assert latest_for(template(type_="duration"), holds).trend is Trend.DOWN


def test_no_sessions_no_results() -> None:
    assert results_for(template(), []) == []
    assert results_for(template(type_="distance_duration"), weekly((hold(600),))) == []
