"""
A local SQLite copy of the Hevy data the app needs.

Only domain models are stored: they have no fields for notes, descriptions or
times of day, so that data never reaches the disk. The store can always be
rebuilt from Hevy, so it's safe to lose (e.g. on a host without a persistent disk).
"""

import json
import sqlite3
from collections.abc import Iterable, Iterator
from contextlib import contextmanager
from dataclasses import asdict
from datetime import date, datetime
from pathlib import Path
from typing import Any

from backend.domain.models import ExerciseTemplate, LoggedSet, PerformedExercise, Routine, Workout

SCHEMA = """
CREATE TABLE IF NOT EXISTS workouts (
    id         TEXT PRIMARY KEY,
    date       TEXT NOT NULL,
    routine_id TEXT,
    exercises  TEXT NOT NULL  -- JSON
);
CREATE TABLE IF NOT EXISTS exercise_templates (
    id                      TEXT PRIMARY KEY,
    title                   TEXT NOT NULL,
    type                    TEXT NOT NULL,
    primary_muscle_group    TEXT NOT NULL,
    secondary_muscle_groups TEXT NOT NULL,  -- JSON
    equipment               TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS routines (
    id           TEXT PRIMARY KEY,
    title        TEXT NOT NULL,
    template_ids TEXT NOT NULL  -- JSON
);
CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""

SYNCED_AT_KEY = "synced_at"


class Store:
    def __init__(self, path: Path):
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as conn:
            conn.execute("PRAGMA journal_mode=WAL")  # readers don't block the background sync
            conn.executescript(SCHEMA)

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        # A short-lived connection per call keeps the store safe to use from the
        # request threads and the background sync thread at the same time.
        conn = sqlite3.connect(self.path)
        try:
            with conn:  # commits on success, rolls back on error
                yield conn
        finally:
            conn.close()

    # --- Writing ------------------------------------------------------------------

    def save(
        self,
        synced_at: datetime,
        *,
        templates: Iterable[ExerciseTemplate] | None = None,
        routines: Iterable[Routine] | None = None,
        all_workouts: Iterable[Workout] | None = None,
        upsert_workouts: Iterable[Workout] = (),
        delete_workout_ids: Iterable[str] = (),
    ) -> None:
        """Applies one sync's changes in a single transaction: all or nothing.

        `templates`, `routines` and `all_workouts` replace what's stored when given;
        `upsert_workouts` and `delete_workout_ids` apply incremental changes.
        """
        with self._connect() as conn:
            if templates is not None:
                conn.execute("DELETE FROM exercise_templates")
                conn.executemany(
                    "INSERT INTO exercise_templates VALUES (?, ?, ?, ?, ?, ?)",
                    [
                        (
                            t.id,
                            t.title,
                            t.type,
                            t.primary_muscle_group,
                            json.dumps(t.secondary_muscle_groups),
                            t.equipment,
                        )
                        for t in templates
                    ],
                )
            if routines is not None:
                conn.execute("DELETE FROM routines")
                conn.executemany(
                    "INSERT INTO routines VALUES (?, ?, ?)",
                    [(r.id, r.title, json.dumps(r.template_ids)) for r in routines],
                )
            if all_workouts is not None:
                conn.execute("DELETE FROM workouts")
                self._upsert_workouts(conn, all_workouts)
            self._upsert_workouts(conn, upsert_workouts)
            conn.executemany(
                "DELETE FROM workouts WHERE id = ?", [(i,) for i in delete_workout_ids]
            )
            conn.execute(
                "INSERT OR REPLACE INTO meta VALUES (?, ?)", (SYNCED_AT_KEY, synced_at.isoformat())
            )

    @staticmethod
    def _upsert_workouts(conn: sqlite3.Connection, workouts: Iterable[Workout]) -> None:
        conn.executemany(
            "INSERT OR REPLACE INTO workouts VALUES (?, ?, ?, ?)",
            [
                (
                    w.id,
                    w.date.isoformat(),
                    w.routine_id,
                    json.dumps([asdict(e) for e in w.exercises]),
                )
                for w in workouts
            ],
        )

    # --- Reading ------------------------------------------------------------------

    def synced_at(self) -> datetime | None:
        with self._connect() as conn:
            row = conn.execute("SELECT value FROM meta WHERE key = ?", (SYNCED_AT_KEY,)).fetchone()
        return datetime.fromisoformat(row[0]) if row else None

    def workouts(self) -> list[Workout]:
        with self._connect() as conn:
            rows = conn.execute("SELECT id, date, routine_id, exercises FROM workouts").fetchall()
        return [
            Workout(
                id=row[0],
                date=date.fromisoformat(row[1]),
                routine_id=row[2],
                exercises=tuple(_exercise(e) for e in json.loads(row[3])),
            )
            for row in rows
        ]

    def templates(self) -> list[ExerciseTemplate]:
        with self._connect() as conn:
            rows = conn.execute("SELECT * FROM exercise_templates").fetchall()
        return [
            ExerciseTemplate(
                id=row[0],
                title=row[1],
                type=row[2],
                primary_muscle_group=row[3],
                secondary_muscle_groups=tuple(json.loads(row[4])),
                equipment=row[5],
            )
            for row in rows
        ]

    def routines(self) -> list[Routine]:
        with self._connect() as conn:
            rows = conn.execute("SELECT id, title, template_ids FROM routines").fetchall()
        return [Routine(row[0], row[1], tuple(json.loads(row[2]))) for row in rows]


def _exercise(data: dict[str, Any]) -> PerformedExercise:
    return PerformedExercise(
        template_id=data["template_id"],
        sets=tuple(LoggedSet(**s) for s in data["sets"]),
    )
