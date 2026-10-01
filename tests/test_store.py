from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

import pytest

from backend.domain.models import LoggedSet, PerformedExercise, Workout
from backend.domain.parsing import parse_routine, parse_template, parse_workout
from backend.store import Store

T0 = datetime(2026, 7, 1, 12, 0, tzinfo=UTC)


@pytest.fixture
def store(tmp_path: Path) -> Store:
    return Store(tmp_path / "test.db")


def make_workout(id_: str, day: int = 1, weight: float = 50) -> Workout:
    sets = (LoggedSet(False, weight, 8, None), LoggedSet(True, 20, 10, None))
    return Workout(id_, date(2026, 6, day), "R1", (PerformedExercise("T1", sets),))


def test_empty_store(store: Store) -> None:
    assert store.synced_at() is None
    assert store.workouts() == []


def test_round_trips_every_model(
    store: Store,
    workouts: list[dict[str, Any]],
    exercise_templates: list[dict[str, Any]],
    routines: list[dict[str, Any]],
) -> None:
    parsed_workouts = [parse_workout(w) for w in workouts]
    parsed_templates = [parse_template(t) for t in exercise_templates]
    parsed_routines = [parse_routine(r) for r in routines]
    store.save(
        T0, templates=parsed_templates, routines=parsed_routines, all_workouts=parsed_workouts
    )

    assert store.synced_at() == T0
    assert sorted(store.workouts(), key=lambda w: w.id) == sorted(
        parsed_workouts, key=lambda w: w.id
    )
    assert sorted(store.templates(), key=lambda t: t.id) == sorted(
        parsed_templates, key=lambda t: t.id
    )
    assert sorted(store.routines(), key=lambda r: r.id) == sorted(
        parsed_routines, key=lambda r: r.id
    )


def test_incremental_changes(store: Store) -> None:
    store.save(T0, all_workouts=[make_workout("A"), make_workout("B")])
    store.save(
        T0,
        upsert_workouts=[make_workout("A", weight=60), make_workout("C")],
        delete_workout_ids=["B"],
    )
    stored = {w.id: w for w in store.workouts()}
    assert set(stored) == {"A", "C"}
    assert stored["A"].exercises[0].sets[0].weight_kg == 60


def test_replacing_all_workouts_removes_old_ones(store: Store) -> None:
    store.save(T0, all_workouts=[make_workout("A")])
    store.save(T0, all_workouts=[make_workout("B")])
    assert [w.id for w in store.workouts()] == ["B"]


def test_a_failed_save_changes_nothing(store: Store) -> None:
    store.save(T0, all_workouts=[make_workout("A")])

    class Boom(Exception):
        pass

    def exploding() -> Any:
        yield make_workout("B")
        raise Boom

    with pytest.raises(Boom):
        store.save(
            datetime(2026, 8, 1, tzinfo=UTC), delete_workout_ids=["A"], upsert_workouts=exploding()
        )
    assert [w.id for w in store.workouts()] == ["A"]
    assert store.synced_at() == T0


def test_data_survives_reopening(tmp_path: Path) -> None:
    Store(tmp_path / "x.db").save(T0, all_workouts=[make_workout("A")])
    assert [w.id for w in Store(tmp_path / "x.db").workouts()] == ["A"]


def test_private_data_never_reaches_the_disk(
    tmp_path: Path, workouts: list[dict[str, Any]]
) -> None:
    store = Store(tmp_path / "private.db")
    store.save(T0, all_workouts=[parse_workout(w) for w in workouts])
    on_disk = b"".join(p.read_bytes() for p in tmp_path.iterdir())  # including the WAL file
    assert b"PRIVATE" not in on_disk  # the fixtures hide private text in notes/descriptions
    assert b"18:00" not in on_disk  # every fixture workout starts at 18:00
