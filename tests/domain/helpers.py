"""Shorthand for building domain objects in tests."""

from datetime import date, timedelta

from backend.domain.models import ExerciseTemplate, LoggedSet, PerformedExercise, Workout

DAY_ONE = date(2026, 6, 1)


def template(
    type_: str = "weight_reps",
    equipment: str = "barbell",
    primary: str = "chest",
    secondary: tuple[str, ...] = (),
    id_: str = "T1",
) -> ExerciseTemplate:
    return ExerciseTemplate(id_, f"Exercise {id_}", type_, primary, secondary, equipment)


def lift(weight_kg: float | None, reps: int | None, warmup: bool = False) -> LoggedSet:
    return LoggedSet(is_warmup=warmup, weight_kg=weight_kg, reps=reps, duration_seconds=None)


def hold(seconds: int) -> LoggedSet:
    return LoggedSet(is_warmup=False, weight_kg=None, reps=None, duration_seconds=seconds)


def workout(day: int, *sets: LoggedSet, template_id: str = "T1") -> Workout:
    """A workout `day` days after DAY_ONE containing one exercise."""
    return Workout(
        id=f"W{day}",
        date=DAY_ONE + timedelta(days=day),
        routine_id=None,
        exercises=(PerformedExercise(template_id, sets),),
    )


def weekly(*sessions: tuple[LoggedSet, ...], template_id: str = "T1") -> list[Workout]:
    """One workout per week, each with the given sets."""
    return [workout(7 * i, *sets, template_id=template_id) for i, sets in enumerate(sessions)]
