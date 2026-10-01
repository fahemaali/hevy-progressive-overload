"""
The plan: double progression with 2-for-2 confirmation (see REQUIREMENTS.md).

Same weight, one more rep each session, up to the top of the rep range. Reach the
top on all working sets twice in a row, then add weight and drop to the bottom
of the range. Three sessions at one weight without beating the session before:
step back about 10% and rebuild.
"""

from dataclasses import dataclass, replace
from enum import StrEnum
from itertools import pairwise

from backend.domain.metrics import (
    PLAN_REPS,
    RepRange,
    TrackingMode,
    epley_e1rm,
    tracking_mode,
    weight_increment,
)
from backend.domain.models import ExerciseTemplate, LoggedSet
from backend.domain.sessions import SessionSummary
from backend.domain.targets import Target, target_score
from backend.domain.verdicts import SessionResult, Trend

STALL_SESSIONS = 3
STEP_BACK_FRACTION = 0.10
DURATION_STEP_SECONDS = 5


class PlanStep(StrEnum):
    BUILDING = "building"  # same weight, one more rep
    CONFIRM = "confirm"  # hit the top of the range once: repeat it
    ADD_WEIGHT = "add_weight"  # hit the top twice in a row: move up
    STALLED = "stalled"  # stuck at one weight: step back and rebuild


@dataclass(frozen=True)
class Plan:
    rep_range: RepRange | None
    step: PlanStep
    today: Target
    then: Target  # the target after today's, if today's is hit
    reps_to_go: int | None  # reps still to add before the weight goes up (building only)
    ahead_of_plan: bool  # the latest session beat what the plan asked for


def plan_next(template: ExerciseTemplate, results: list[SessionResult]) -> Plan | None:
    """The plan for the next session, from results in one rep range, oldest first."""
    if not results:
        return None
    mode = tracking_mode(template)
    step, today = next_target(template, mode, results)
    _, then = next_target(template, mode, [*results, _as_if_hit(mode, today, results[-1])])

    last = results[-1].session
    reps_to_go = None
    if step is PlanStep.BUILDING and last.rep_range and last.working_reps:
        reps_to_go = PLAN_REPS[last.rep_range][1] - min(last.working_reps)

    return Plan(
        rep_range=last.rep_range,
        step=step,
        today=today,
        then=then,
        reps_to_go=reps_to_go,
        ahead_of_plan=results[-1].ahead_of_target,
    )


def next_target(
    template: ExerciseTemplate, mode: TrackingMode, results: list[SessionResult]
) -> tuple[PlanStep, Target]:
    """What to aim for after the given results (one rep range, oldest first, not empty)."""
    last = results[-1].session

    if mode is TrackingMode.REPS:
        return PlanStep.BUILDING, Target(reps=int(last.score) + 1, sets=len(last.working_reps))
    if mode is TrackingMode.DURATION:
        return PlanStep.BUILDING, Target(duration_seconds=int(last.score) + DURATION_STEP_SECONDS)

    assert last.rep_range is not None and last.working_weight_kg is not None
    bottom, top = PLAN_REPS[last.rep_range]
    weight = last.working_weight_kg
    lowest_reps = min(last.working_reps)
    sets = len(last.working_reps)
    harder = _harder_weight(mode, template, weight)

    if lowest_reps >= top:
        if harder is None:
            # Already unassisted: the only way forward is more reps.
            return PlanStep.BUILDING, Target(weight, lowest_reps + 1, sets=sets)
        if _hit_top_before(results, weight, top):
            return PlanStep.ADD_WEIGHT, Target(harder, bottom, sets=sets)
        return PlanStep.CONFIRM, Target(weight, top, sets=sets)

    if _stalled(results, weight, mode):
        lighter = _step_back_weight(mode, template, weight)
        reps = min(max(lowest_reps, bottom), top)
        return PlanStep.STALLED, Target(lighter, reps, sets=sets)

    return PlanStep.BUILDING, Target(weight, lowest_reps + 1, sets=sets)


def _hit_top_before(results: list[SessionResult], weight: float, top: int) -> bool:
    """Did the session before the latest also reach the top at this weight? (2-for-2)"""
    if len(results) < 2:
        return False
    previous = results[-2].session
    return previous.working_weight_kg == weight and min(previous.working_reps) >= top


def _stalled(results: list[SessionResult], weight: float, mode: TrackingMode) -> bool:
    """The last few sessions were all at this weight and none beat the session before it."""
    recent = [r.session for r in results[-(STALL_SESSIONS + 1) :]]
    return (
        len(recent) == STALL_SESSIONS + 1
        and all(s.working_weight_kg == weight for s in recent[1:])
        and not any(_improved(cur, prev, mode) for prev, cur in pairwise(recent))
    )


def _improved(current: SessionSummary, previous: SessionSummary, mode: TrackingMode) -> bool:
    """A better score, or more total reps at the same working weight."""
    if mode is TrackingMode.ASSISTED:
        better_score = current.score < previous.score
    else:
        better_score = current.score > previous.score
    more_reps = current.working_weight_kg == previous.working_weight_kg and sum(
        current.working_reps
    ) > sum(previous.working_reps)
    return better_score or more_reps


def _harder_weight(mode: TrackingMode, template: ExerciseTemplate, weight: float) -> float | None:
    step = weight_increment(template.equipment)
    if mode is TrackingMode.ASSISTED:
        return max(0.0, weight - step) if weight > 0 else None
    return weight + step


def _step_back_weight(mode: TrackingMode, template: ExerciseTemplate, weight: float) -> float:
    """About 10% easier, in whole increments (at least one)."""
    step = weight_increment(template.equipment)
    steps = max(1, round(weight * STEP_BACK_FRACTION / step))
    if mode is TrackingMode.ASSISTED:
        return weight + steps * step
    lighter = weight - steps * step
    return lighter if lighter > 0 else weight


def _as_if_hit(mode: TrackingMode, target: Target, last: SessionResult) -> SessionResult:
    """A pretend session that hits the target exactly, used to look one step ahead."""
    reps = (target.reps,) * target.sets if target.reps is not None else ()
    weight = target.weight_kg
    session = replace(
        last.session,
        workout_id="planned",
        score=target_score(mode, target),
        top_set=LoggedSet(False, weight, target.reps, target.duration_seconds),
        best_e1rm=epley_e1rm(weight, target.reps or 0)
        if mode is TrackingMode.LOAD and weight
        else None,
        working_weight_kg=weight,
        working_reps=reps,
        set_count=target.sets,
    )
    return SessionResult(session, Trend.UP, None, False, None, target, session.score, 0)
