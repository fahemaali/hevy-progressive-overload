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


def compare_to_target(mode: TrackingMode, session: SessionSummary, target: Target) -> int:
    """1 if the session beat the target, 0 if it matched it, -1 if it fell short."""
    if mode is TrackingMode.ASSISTED:
        # Less assistance beats the target; at the same assistance, compare reps.
        weight, target_weight = session.working_weight_kg or 0, target.weight_kg or 0
        if weight != target_weight:
            return 1 if weight < target_weight else -1
        reps, target_reps = min(session.working_reps, default=0), target.reps or 0
        return (reps > target_reps) - (reps < target_reps)

    # Rounded so float noise can't turn a match into a miss.
    actual = round(session.score, 2)
    wanted = round(target_score(mode, target), 2)
    return (actual > wanted) - (actual < wanted)
