"""Capacity: suggesting a weight from how much other exercises for the muscle improved."""

from backend.domain.capacity import CapacityHint
from backend.domain.models import ExerciseTemplate, LoggedSet, Workout
from backend.domain.progress import analyse_all
from tests.domain.helpers import lift, template, workout

ROW = template(primary="upper_back", equipment="machine", id_="ROW")  # 5 kg steps
PULLDOWN = template(primary="upper_back", id_="PULL")
FACE_PULL = template(primary="upper_back", id_="FACE")
CURL = template(primary="biceps", secondary=("upper_back",), id_="CURL")
SQUAT = template(primary="quadriceps", id_="SQUAT")


def capacity(templates: list[ExerciseTemplate], workouts: list[Workout]) -> CapacityHint | None:
    row = analyse_all(templates, workouts)["ROW"].default_range
    assert row is not None
    return row.capacity


def session(day: int, template_id: str, *sets: LoggedSet) -> Workout:
    return workout(day, *sets, template_id=template_id)


def test_applies_other_exercises_improvement_since_last_done() -> None:
    workouts = [
        session(0, "PULL", lift(50, 8)),
        session(1, "ROW", lift(40, 8)),  # last time this exercise was done
        session(14, "PULL", lift(60, 8)),  # +20% since then
    ]
    hint = capacity([ROW, PULLDOWN], workouts)
    assert hint is not None
    assert hint.change_pct == 20.0
    assert hint.weight_kg == 45  # +20% is capped at +10%: 44 kg, so one 5 kg step
    assert [e.template_id for e in hint.evidence] == ["PULL"]


def test_averages_evidence_with_secondary_exercises_counting_half() -> None:
    workouts = [
        session(0, "PULL", lift(50, 8)),
        session(0, "CURL", lift(10, 8)),
        session(1, "ROW", lift(100, 8)),
        session(14, "PULL", lift(60, 8)),  # +20%, counts fully
        session(14, "CURL", lift(12.5, 8)),  # +25%, counts half
    ]
    hint = capacity([ROW, PULLDOWN, CURL], workouts)
    assert hint is not None
    assert hint.change_pct == 21.7  # (20 × 1 + 25 × 0.5) / 1.5


def test_compares_each_exercise_with_itself_in_the_same_rep_range() -> None:
    # The pulldown's heavy session before and light session after can't be compared.
    workouts = [
        session(0, "PULL", lift(50, 8)),
        session(1, "ROW", lift(40, 8)),
        session(14, "PULL", lift(30, 20)),
    ]
    assert capacity([ROW, PULLDOWN], workouts) is None


def test_no_hint_without_improvement() -> None:
    workouts = [
        session(0, "PULL", lift(50, 8)),
        session(1, "ROW", lift(40, 8)),
        session(14, "PULL", lift(47.5, 8)),
    ]
    assert capacity([ROW, PULLDOWN], workouts) is None


def test_no_hint_when_improvement_is_less_than_one_increment() -> None:
    workouts = [
        session(0, "PULL", lift(50, 8)),
        session(1, "ROW", lift(40, 8)),
        session(14, "PULL", lift(52.5, 8)),  # +5% of 40 kg is 2 kg: less than a 5 kg step
    ]
    assert capacity([ROW, PULLDOWN], workouts) is None


def test_ignores_other_muscles_and_exercises_without_before_and_after() -> None:
    workouts = [
        session(0, "SQUAT", lift(100, 5)),
        session(1, "ROW", lift(40, 8)),
        session(14, "SQUAT", lift(150, 5)),  # different muscle
        session(14, "FACE", lift(20, 10)),  # no session before the row: no evidence
    ]
    assert capacity([ROW, SQUAT, FACE_PULL], workouts) is None


def test_big_evidence_is_capped_at_ten_percent() -> None:
    barbell_row = template(primary="upper_back", equipment="barbell", id_="ROW")
    workouts = [
        session(0, "PULL", lift(50, 8)),
        session(1, "ROW", lift(100, 8)),
        session(14, "PULL", lift(80, 8)),  # +60%: early gains, not a safe jump
    ]
    hint = capacity([barbell_row, PULLDOWN], workouts)
    assert hint is not None
    assert hint.change_pct == 60.0  # the evidence is shown in full…
    assert hint.weight_kg == 110  # …but the suggestion is capped at +10%
