"""Summarises each session of an exercise into the numbers progress is judged on."""

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date

from backend.domain.metrics import RepRange, TrackingMode, epley_e1rm, rep_range, tracking_mode
from backend.domain.models import ExerciseTemplate, LoggedSet, Workout


@dataclass(frozen=True)
class SessionSummary:
    workout_id: str
    date: date
    # Set for weighted exercises only; a session with both heavy and light sets
    # produces one summary per range.
    rep_range: RepRange | None
    # The number the verdict compares: e1RM, best reps, assistance kg or hold seconds.
    score: float
    top_set: LoggedSet
    best_e1rm: float | None
    total_reps: int
    volume_kg: float
    set_count: int


def summarise_sessions(
    template: ExerciseTemplate, workouts: Iterable[Workout]
) -> list[SessionSummary]:
    """One summary per session (and per rep range for weighted exercises), oldest first."""
    mode = tracking_mode(template)
    summaries: list[SessionSummary] = []
    for workout in sorted(workouts, key=lambda w: (w.date, w.id)):
        sets = [
            s
            for ex in workout.exercises
            if ex.template_id == template.id
            for s in ex.sets
            if not s.is_warmup
        ]
        if sets:
            summaries.extend(_summarise(mode, workout, sets))
    return summaries


def _summarise(mode: TrackingMode, workout: Workout, sets: list[LoggedSet]) -> list[SessionSummary]:
    if mode is TrackingMode.LOAD:
        return _summarise_load(workout, sets)

    if mode is TrackingMode.REPS:
        usable = [s for s in sets if s.reps]
        if not usable:
            return []
        top = max(usable, key=lambda s: s.reps or 0)
        return [_summary(workout, None, float(top.reps or 0), top, usable)]

    if mode is TrackingMode.ASSISTED:
        usable = [s for s in sets if s.reps and s.weight_kg is not None]
        if not usable:
            return []
        # Best set: least assistance, then most reps.
        top = min(usable, key=lambda s: (s.weight_kg or 0, -(s.reps or 0)))
        return [_summary(workout, None, top.weight_kg or 0, top, usable)]

    if mode is TrackingMode.DURATION:
        usable = [s for s in sets if s.duration_seconds]
        if not usable:
            return []
        top = max(usable, key=lambda s: s.duration_seconds or 0)
        return [_summary(workout, None, float(top.duration_seconds or 0), top, usable)]

    return []  # TrackingMode.UNTRACKED


def _summarise_load(workout: Workout, sets: list[LoggedSet]) -> list[SessionSummary]:
    by_range: dict[RepRange, list[LoggedSet]] = {}
    for s in sets:
        if s.weight_kg and s.reps:
            by_range.setdefault(rep_range(s.reps), []).append(s)

    summaries = []
    for range_, range_sets in by_range.items():
        top = max(range_sets, key=_e1rm)
        volume = sum((s.weight_kg or 0) * (s.reps or 0) for s in range_sets)
        summaries.append(
            _summary(
                workout, range_, _e1rm(top), top, range_sets, best_e1rm=_e1rm(top), volume_kg=volume
            )
        )
    return summaries


def _e1rm(s: LoggedSet) -> float:
    return epley_e1rm(s.weight_kg or 0, s.reps or 0)


def _summary(
    workout: Workout,
    range_: RepRange | None,
    score: float,
    top: LoggedSet,
    sets: list[LoggedSet],
    best_e1rm: float | None = None,
    volume_kg: float = 0.0,
) -> SessionSummary:
    return SessionSummary(
        workout_id=workout.id,
        date=workout.date,
        rep_range=range_,
        score=score,
        top_set=top,
        best_e1rm=best_e1rm,
        total_reps=sum(s.reps or 0 for s in sets),
        volume_kg=volume_kg,
        set_count=len(sets),
    )
