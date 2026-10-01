"""Guards on the synthetic fixtures themselves, so later tests can rely on what they contain."""

from typing import Any


def test_fixtures_cover_every_exercise_type(exercise_templates: list[dict[str, Any]]) -> None:
    types = {t["type"] for t in exercise_templates}
    assert {
        "weight_reps",
        "reps_only",
        "duration",
        "bodyweight_assisted",
        "distance_duration",
    } <= types


def test_fixtures_include_warmups_high_reps_and_notes(workouts: list[dict[str, Any]]) -> None:
    sets = [s for w in workouts for e in w["exercises"] for s in e["sets"]]
    assert any(s["type"] == "warmup" for s in sets)
    assert any((s["reps"] or 0) > 12 and s["weight_kg"] for s in sets)
    assert any(w["description"] for w in workouts)
    assert any(e["notes"] for w in workouts for e in w["exercises"])


def test_workouts_reference_known_templates_and_routines(
    workouts: list[dict[str, Any]],
    exercise_templates: list[dict[str, Any]],
    routines: list[dict[str, Any]],
) -> None:
    template_ids = {t["id"] for t in exercise_templates}
    routine_ids = {r["id"] for r in routines}
    for w in workouts:
        assert w["routine_id"] in routine_ids
        for e in w["exercises"]:
            assert e["exercise_template_id"] in template_ids
