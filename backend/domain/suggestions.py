"""Suggests targets for the next session, based on the latest one."""

from dataclasses import dataclass
from enum import StrEnum

from backend.domain.metrics import (
    REP_RANGE_BOUNDS,
    TrackingMode,
    epley_e1rm,
    tracking_mode,
    weight_increment,
)
from backend.domain.models import ExerciseTemplate
from backend.domain.sessions import SessionSummary

DURATION_STEP_SECONDS = 5
# When adding weight, never target more than this many reps below the last session.
# Without it, a big jump on a light weight (e.g. 10 → 15 kg) suggests silly 1–2 rep sets.
MAX_REP_DROP = 2


class SuggestionKind(StrEnum):
    ADD_WEIGHT = "add_weight"
    ADD_REPS = "add_reps"
    LESS_ASSISTANCE = "less_assistance"
    ADD_TIME = "add_time"


@dataclass(frozen=True)
class Suggestion:
    kind: SuggestionKind
    weight_kg: float | None = None
    reps: int | None = None
    duration_seconds: int | None = None
    e1rm: float | None = None
    e1rm_change_pct: float | None = None


def suggest_next(template: ExerciseTemplate, sessions: list[SessionSummary]) -> list[Suggestion]:
    """Overload options for the next session, offered side by side.

    `sessions` must be oldest first; suggestions build on the latest one and
    stay within its rep range.
    """
    if not sessions:
        return []
    latest = sessions[-1]
    top = latest.top_set
    mode = tracking_mode(template)

    if mode is TrackingMode.LOAD and latest.rep_range and latest.best_e1rm:
        return _load_suggestions(template, latest)

    if mode is TrackingMode.REPS and top.reps:
        return [Suggestion(SuggestionKind.ADD_REPS, reps=top.reps + 1)]

    if mode is TrackingMode.ASSISTED and top.reps and top.weight_kg is not None:
        options = []
        if top.weight_kg > 0:
            less = max(0.0, top.weight_kg - weight_increment(template.equipment))
            options.append(
                Suggestion(SuggestionKind.LESS_ASSISTANCE, weight_kg=less, reps=top.reps)
            )
        options.append(
            Suggestion(SuggestionKind.ADD_REPS, weight_kg=top.weight_kg, reps=top.reps + 1)
        )
        return options

    if mode is TrackingMode.DURATION and top.duration_seconds:
        seconds = top.duration_seconds + DURATION_STEP_SECONDS
        return [Suggestion(SuggestionKind.ADD_TIME, duration_seconds=seconds)]

    return []


def _load_suggestions(template: ExerciseTemplate, latest: SessionSummary) -> list[Suggestion]:
    assert latest.rep_range and latest.best_e1rm  # guaranteed by the caller
    weight = latest.top_set.weight_kg or 0
    reps = latest.top_set.reps or 0
    min_reps, max_reps = REP_RANGE_BOUNDS[latest.rep_range]
    to_beat = latest.best_e1rm

    # Add weight: the fewest reps at the heavier weight that beat the last e1RM,
    # but no more than MAX_REP_DROP below last time, and not below the rep range.
    heavier = weight + weight_increment(template.equipment)
    target_reps = max(min_reps, reps - MAX_REP_DROP)
    while epley_e1rm(heavier, target_reps) <= to_beat and (
        max_reps is None or target_reps < max_reps
    ):
        target_reps += 1
    options = [_load_option(SuggestionKind.ADD_WEIGHT, heavier, target_reps, to_beat)]

    # Add reps: same weight, one more rep, unless that would leave the rep range,
    # in which case adding weight is the way forward.
    if max_reps is None or reps < max_reps:
        options.append(_load_option(SuggestionKind.ADD_REPS, weight, reps + 1, to_beat))
    return options


def _load_option(
    kind: SuggestionKind, weight: float, reps: int, previous_e1rm: float
) -> Suggestion:
    e1rm = epley_e1rm(weight, reps)
    return Suggestion(
        kind,
        weight_kg=weight,
        reps=reps,
        e1rm=e1rm,
        e1rm_change_pct=(e1rm - previous_e1rm) / previous_e1rm * 100,
    )
