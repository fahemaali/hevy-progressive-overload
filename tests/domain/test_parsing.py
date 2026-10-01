from datetime import date
from typing import Any

from backend.domain.parsing import parse_routine, parse_template, parse_workout


def test_parses_workout_to_calendar_date(workouts: list[dict[str, Any]]) -> None:
    raw = next(w for w in workouts if w["id"] == "W-PUSH-1")
    parsed = parse_workout(raw)
    assert parsed.date == date(2026, 6, 1)
    assert parsed.routine_id == "R-PUSH"
    assert parsed.exercises[0].template_id == "T-BENCH"


def test_marks_warmup_sets(workouts: list[dict[str, Any]]) -> None:
    raw = next(w for w in workouts if w["id"] == "W-PUSH-1")
    bench = parse_workout(raw).exercises[0]
    assert [s.is_warmup for s in bench.sets] == [True, False, False, False]


def test_parses_template_and_routine(
    exercise_templates: list[dict[str, Any]], routines: list[dict[str, Any]]
) -> None:
    bench = parse_template(exercise_templates[0])
    assert bench.secondary_muscle_groups == ("triceps", "shoulders")
    assert bench.equipment == "barbell"
    assert parse_routine(routines[0]).template_ids[:2] == ("T-BENCH", "T-CHESTPRESS")


def test_missing_equipment_defaults_to_other(exercise_templates: list[dict[str, Any]]) -> None:
    raw = {**exercise_templates[0], "equipment": None}
    assert parse_template(raw).equipment == "other"


# --- Privacy --------------------------------------------------------------------


def test_notes_descriptions_and_times_are_dropped(workouts: list[dict[str, Any]]) -> None:
    parsed = repr([parse_workout(w) for w in workouts])
    assert "PRIVATE" not in parsed  # the fixtures hide private text in notes/descriptions
    assert "18:00" not in parsed  # every fixture workout starts at 18:00
