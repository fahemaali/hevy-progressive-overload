import pytest

from backend.domain.metrics import epley_e1rm
from backend.domain.models import ExerciseTemplate, LoggedSet
from backend.domain.sessions import summarise_sessions
from backend.domain.suggestions import Suggestion, SuggestionKind, suggest_next
from tests.domain.helpers import hold, lift, template, workout


def suggest(t: ExerciseTemplate, *sets: LoggedSet) -> dict[SuggestionKind, Suggestion]:
    options = suggest_next(t, summarise_sessions(t, [workout(0, *sets)]))
    return {o.kind: o for o in options}


def target(option: Suggestion) -> tuple[float | None, int | None]:
    return option.weight_kg, option.reps


def test_add_weight_needs_the_fewest_reps_that_beat_last_e1rm() -> None:
    # Last: 52.5 × 9 (e1RM 68.25). At 55 kg, 8 reps (69.67) is the fewest that beats it.
    add_weight = suggest(template(equipment="barbell"), lift(52.5, 9))[SuggestionKind.ADD_WEIGHT]
    assert target(add_weight) == (55, 8)
    assert add_weight.e1rm_change_pct is not None and add_weight.e1rm_change_pct > 0


@pytest.mark.parametrize(
    ("type_", "last", "expected"),
    [
        # Big jumps on light weights: the e1RM would be beaten at 1–2 reps, but
        # the target never drops more than 2 reps below last time.
        ("bodyweight_weighted", (10, 12), (15, 10)),
        ("weight_reps", (29.5, 7), (34.5, 5)),
    ],
)
def test_add_weight_drops_at_most_two_reps(
    type_: str, last: tuple[float, int], expected: tuple[float, int]
) -> None:
    options = suggest(template(type_=type_, equipment="machine"), lift(*last))
    assert target(options[SuggestionKind.ADD_WEIGHT]) == expected


def test_add_reps_keeps_weight_and_adds_one_rep() -> None:
    add_reps = suggest(template(), lift(52.5, 9))[SuggestionKind.ADD_REPS]
    assert target(add_reps) == (52.5, 10)
    assert add_reps.e1rm == pytest.approx(epley_e1rm(52.5, 10))


def test_both_options_always_beat_last_session() -> None:
    for weight, reps in [(20, 1), (40, 6), (100, 12), (25, 15)]:
        last = epley_e1rm(weight, reps)
        for option in suggest(template(), lift(weight, reps)).values():
            assert option.e1rm is not None and option.e1rm > last


@pytest.mark.parametrize(("equipment", "expected"), [("dumbbell", 22), ("machine", 25)])
def test_increment_follows_equipment(equipment: str, expected: float) -> None:
    options = suggest(template(equipment=equipment), lift(20, 8))
    assert options[SuggestionKind.ADD_WEIGHT].weight_kg == expected


def test_top_of_strength_range_offers_add_weight_only() -> None:
    # 13 reps would move into the High-rep range, so adding reps isn't offered.
    options = suggest(template(), lift(50, 12))
    assert set(options) == {SuggestionKind.ADD_WEIGHT}


def test_high_rep_suggestions_stay_in_high_rep_range() -> None:
    # Last: 25 × 15 (e1RM 37.5). At 27.5 kg, 11 reps would beat it, but the
    # High-rep range starts at 13.
    options = suggest(template(equipment="barbell"), lift(25, 15))
    assert options[SuggestionKind.ADD_WEIGHT].reps == 13
    assert options[SuggestionKind.ADD_REPS].reps == 16


def test_builds_on_the_latest_session() -> None:
    t = template()
    sessions = summarise_sessions(t, [workout(0, lift(100, 5)), workout(7, lift(50, 8))])
    weights = {o.weight_kg for o in suggest_next(t, sessions)}
    assert weights == {50, 52.5}


def test_reps_only() -> None:
    assert suggest(template(type_="reps_only"), lift(None, 15)) == {
        SuggestionKind.ADD_REPS: Suggestion(SuggestionKind.ADD_REPS, reps=16)
    }


def test_assisted() -> None:
    options = suggest(template(type_="bodyweight_assisted", equipment="machine"), lift(25, 8))
    assert target(options[SuggestionKind.LESS_ASSISTANCE]) == (20, 8)
    assert target(options[SuggestionKind.ADD_REPS]) == (25, 9)


def test_assisted_never_suggests_negative_assistance() -> None:
    options = suggest(template(type_="bodyweight_assisted", equipment="machine"), lift(2.5, 8))
    assert options[SuggestionKind.LESS_ASSISTANCE].weight_kg == 0
    unassisted = suggest(template(type_="bodyweight_assisted"), lift(0, 8))
    assert set(unassisted) == {SuggestionKind.ADD_REPS}


def test_duration() -> None:
    options = suggest(template(type_="duration"), hold(60))
    assert options[SuggestionKind.ADD_TIME].duration_seconds == 65


def test_nothing_to_suggest() -> None:
    assert suggest_next(template(), []) == []
    assert suggest(template(type_="distance_duration"), hold(600)) == {}
