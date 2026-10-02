"""What the plan asks for in a session, and how a session measures up against it."""

from dataclasses import dataclass

from backend.domain.metrics import TrackingMode, epley_e1rm
from backend.domain.sessions import SessionSummary


@dataclass(frozen=True)
class Target:
    weight_kg: float | None = None
    reps: int | None = None
    duration_seconds: int | None = None
    sets: int = 1


def target_score(mode: TrackingMode, target: Target) -> float:
    """The target in the same units as SessionSummary.score, so the two can be
    charted together (actual vs target)."""
    if mode is TrackingMode.LOAD:
        return epley_e1rm(target.weight_kg or 0, target.reps or 0)
    if mode is TrackingMode.ASSISTED:
        return target.weight_kg or 0
    if mode is TrackingMode.REPS:
        return float(target.reps or 0)
    return float(target.duration_seconds or 0)


def did_score(mode: TrackingMode, session: SessionSummary) -> float:
    """What a session did (its working weight, for the reps every working set reached),
    scored like a target, so it sits on the same scale as the plan. For lifts this is
    the strength score the chart plots: the same weight for more reps scores higher."""
    did = Target(
        weight_kg=session.working_weight_kg,
        reps=min(session.working_reps, default=0),
        duration_seconds=session.top_set.duration_seconds,
    )
    return target_score(mode, did)


def compare_to_target(mode: TrackingMode, session: SessionSummary, target: Target) -> int:
    """1 if the session beat the target, 0 if it matched it, -1 if it fell short.

    Judged the way the plan works: a heavier working weight beats the target; at the
    same weight, more reps on every set beats it. A lighter weight falls short, however
    many reps, so the plan, the cards and the chart (which plots weight) always agree.
    """
    if mode in (TrackingMode.LOAD, TrackingMode.ASSISTED):
        weight, wanted = session.working_weight_kg or 0, target.weight_kg or 0
        if weight != wanted:
            heavier = weight > wanted
            harder = not heavier if mode is TrackingMode.ASSISTED else heavier
            return 1 if harder else -1
        reps, target_reps = min(session.working_reps, default=0), target.reps or 0
        return (reps > target_reps) - (reps < target_reps)

    # Reps or seconds: rounded so float noise can't turn a match into a miss.
    actual = round(session.score, 2)
    goal = round(target_score(mode, target), 2)
    return (actual > goal) - (actual < goal)
