"""
Builds the synthetic Hevy data the test suite runs on. Run with:

    python -m tests.fixtures.build_fixtures

The output is committed so tests never need a real API key. The data mirrors
the shape of real Hevy API responses but is entirely made up. It is designed
to cover the cases the domain logic must handle: tagged warm-up sets,
strength and high-rep ranges, bodyweight / assisted / timed / distance
exercises, and free-text notes (which must never reach the app's output).
"""

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

OUT_DIR = Path(__file__).parent
START = datetime(2026, 6, 1, 18, 0, tzinfo=UTC)  # a Monday

TEMPLATES: list[dict[str, Any]] = [
    {
        "id": "T-BENCH",
        "title": "Bench Press (Barbell)",
        "type": "weight_reps",
        "primary_muscle_group": "chest",
        "secondary_muscle_groups": ["triceps", "shoulders"],
        "equipment": "barbell",
        "is_custom": False,
    },
    {
        "id": "T-CHESTPRESS",
        "title": "Chest Press (Machine)",
        "type": "weight_reps",
        "primary_muscle_group": "chest",
        "secondary_muscle_groups": ["triceps"],
        "equipment": "machine",
        "is_custom": False,
    },
    {
        "id": "T-PUSHUP",
        "title": "Push Up",
        "type": "reps_only",
        "primary_muscle_group": "chest",
        "secondary_muscle_groups": ["triceps", "shoulders"],
        "equipment": "none",
        "is_custom": False,
    },
    {
        "id": "T-PLANK",
        "title": "Plank",
        "type": "duration",
        "primary_muscle_group": "abdominals",
        "secondary_muscle_groups": [],
        "equipment": "none",
        "is_custom": False,
    },
    {
        "id": "T-PULLDOWN",
        "title": "Lat Pulldown (Cable)",
        "type": "weight_reps",
        "primary_muscle_group": "lats",
        "secondary_muscle_groups": ["biceps"],
        "equipment": "machine",
        "is_custom": False,
    },
    {
        "id": "T-ASSISTPULLUP",
        "title": "Assisted Pull Up",
        "type": "bodyweight_assisted",
        "primary_muscle_group": "lats",
        "secondary_muscle_groups": ["biceps"],
        "equipment": "machine",
        "is_custom": False,
    },
    {
        "id": "T-TREADMILL",
        "title": "Treadmill",
        "type": "distance_duration",
        "primary_muscle_group": "cardio",
        "secondary_muscle_groups": [],
        "equipment": "machine",
        "is_custom": False,
    },
]

ROUTINES: list[dict[str, Any]] = [
    {
        "id": "R-PUSH",
        "title": "Push",
        "templates": ["T-BENCH", "T-CHESTPRESS", "T-PUSHUP", "T-PLANK"],
    },
    {"id": "R-PULL", "title": "Pull", "templates": ["T-PULLDOWN", "T-ASSISTPULLUP", "T-TREADMILL"]},
]

# Per-week working sets as (weight_kg, reps) or the type's own fields.
# Bench: steady strength progress, with a regression in the final week.
BENCH = [(50, 8), (50, 9), (52.5, 8), (52.5, 9), (55, 8), (55, 8), (55, 9), (52.5, 7)]
# Chest press: alternates heavy (8 reps) and light high-rep (15+) weeks.
CHEST_PRESS = [(40, 8), (25, 15), (42.5, 8), (25, 17), (42.5, 9), (27.5, 15), (45, 8), (27.5, 16)]
PUSH_UPS = [12, 12, 13, 14, 14, 15, 15, 16]
PLANK_SECONDS = [45, 50, 50, 55, 60, 60, 65, 70]
PULLDOWN = [(45, 10), (45, 10), (45, 10), (47.5, 9), (45, 10), (45, 10), (47.5, 9), (45, 10)]
# Assisted pull-up: assistance falls over time, which is progress.
ASSIST_KG = [30, 30, 27.5, 27.5, 25, 25, 22.5, 22.5]


def _set(index: int, set_type: str = "normal", **fields: Any) -> dict[str, Any]:
    return {
        "index": index,
        "type": set_type,
        "weight_kg": fields.get("weight_kg"),
        "reps": fields.get("reps"),
        "distance_meters": fields.get("distance_meters"),
        "duration_seconds": fields.get("duration_seconds"),
        "rpe": None,
        "custom_metric": None,
    }


def _exercise(
    index: int, template_id: str, sets: list[dict[str, Any]], notes: str = ""
) -> dict[str, Any]:
    title = next(t["title"] for t in TEMPLATES if t["id"] == template_id)
    return {
        "index": index,
        "title": title,
        "notes": notes,
        "exercise_template_id": template_id,
        "superset_id": None,
        "sets": sets,
    }


def _workout(
    workout_id: str,
    title: str,
    routine_id: str,
    start: datetime,
    exercises: list[dict[str, Any]],
    description: str = "",
) -> dict[str, Any]:
    stamp = start.isoformat()
    end = (start + timedelta(hours=1)).isoformat()
    return {
        "id": workout_id,
        "title": title,
        "routine_id": routine_id,
        "description": description,
        "start_time": stamp,
        "end_time": end,
        "updated_at": end,
        "created_at": end,
        "exercises": exercises,
    }


def build_workouts() -> list[dict[str, Any]]:
    workouts = []
    for week in range(8):
        push_day = START + timedelta(weeks=week)
        bench_w, bench_r = BENCH[week]
        press_w, press_r = CHEST_PRESS[week]
        push = [
            _exercise(
                0,
                "T-BENCH",
                # One tagged warm-up set, then three working sets.
                [_set(0, "warmup", weight_kg=20, reps=10)]
                + [_set(i, weight_kg=bench_w, reps=bench_r) for i in range(1, 4)],
                notes="PRIVATE NOTE: shoulder felt a bit off" if week == 2 else "",
            ),
            _exercise(
                1, "T-CHESTPRESS", [_set(i, weight_kg=press_w, reps=press_r) for i in range(3)]
            ),
            _exercise(2, "T-PUSHUP", [_set(i, reps=PUSH_UPS[week]) for i in range(2)]),
            _exercise(3, "T-PLANK", [_set(0, duration_seconds=PLANK_SECONDS[week])]),
        ]
        workouts.append(
            _workout(
                f"W-PUSH-{week + 1}",
                "Push",
                "R-PUSH",
                push_day,
                push,
                description="PRIVATE DESCRIPTION: trained after work" if week == 0 else "",
            )
        )

        pull_day = push_day + timedelta(days=2)
        pull_w, pull_r = PULLDOWN[week]
        pull = [
            _exercise(0, "T-PULLDOWN", [_set(i, weight_kg=pull_w, reps=pull_r) for i in range(3)]),
            _exercise(
                1, "T-ASSISTPULLUP", [_set(i, weight_kg=ASSIST_KG[week], reps=8) for i in range(3)]
            ),
            _exercise(2, "T-TREADMILL", [_set(0, distance_meters=2000, duration_seconds=720)]),
        ]
        workouts.append(_workout(f"W-PULL-{week + 1}", "Pull", "R-PULL", pull_day, pull))

    # Hevy returns newest first.
    return sorted(workouts, key=lambda w: w["start_time"], reverse=True)


def build_routines() -> list[dict[str, Any]]:
    stamp = START.isoformat()
    return [
        {
            "id": r["id"],
            "title": r["title"],
            "folder_id": None,
            "created_at": stamp,
            "updated_at": stamp,
            "exercises": [
                _exercise(i, template_id, [_set(0)]) | {"rest_seconds": 90}
                for i, template_id in enumerate(r["templates"])
            ],
        }
        for r in ROUTINES
    ]


def main() -> None:
    outputs = {
        "exercise_templates.json": TEMPLATES,
        "workouts.json": build_workouts(),
        "routines.json": build_routines(),
    }
    for name, data in outputs.items():
        (OUT_DIR / name).write_text(json.dumps(data, indent=2) + "\n")
        print(f"wrote {name}")


if __name__ == "__main__":
    main()
