"""
The exact shape of every API response.

This is the privacy boundary: a field only leaves the server if it's listed in
one of these types. Dates are calendar dates; no times of day, notes or workout
ids are ever included.
"""

from datetime import date, timedelta
from typing import Literal, TypedDict

from backend.domain.metrics import PLAN_REPS, TrackingMode
from backend.domain.plan import Plan
from backend.domain.progress import (
    ExerciseProgress,
    MuscleGroupSummary,
    MuscleWeek,
    RangeProgress,
    Role,
    StrengthEntry,
)
from backend.domain.sessions import SessionSummary
from backend.domain.targets import Target, did_score, target_score
from backend.domain.verdicts import SessionResult, Trend

# Every Hevy muscle group that has a place on the body map.
BODY_MUSCLES = (
    "abdominals",
    "abductors",
    "adductors",
    "biceps",
    "calves",
    "chest",
    "forearms",
    "glutes",
    "hamstrings",
    "lats",
    "lower_back",
    "neck",
    "quadriceps",
    "shoulders",
    "traps",
    "triceps",
    "upper_back",
)

MuscleState = Literal[
    "progressing",
    "not_progressing",
    "declining",
    "no_status",  # trained directly, but nothing could be judged yet
    "indirect_only",  # only ever trained as a secondary muscle: not tracked
    "never_trained",
]

TREND_STATES: dict[Trend, MuscleState] = {
    Trend.UP: "progressing",
    Trend.FLAT: "not_progressing",
    Trend.DOWN: "declining",
}


def muscle_label(group: str) -> str:
    return group.replace("_", " ").capitalize()


def iso(day: date | None) -> str | None:
    return day.isoformat() if day else None


# --- Shared pieces -------------------------------------------------------------------


class TargetJSON(TypedDict):
    weight_kg: float | None
    reps: int | None
    duration_seconds: int | None
    sets: int
    score: float  # on the same scale as SessionJSON.did_score (for lifts, Epley e1RM)


def target_json(target: Target, mode: TrackingMode) -> TargetJSON:
    return {
        "weight_kg": target.weight_kg,
        "reps": target.reps,
        "duration_seconds": target.duration_seconds,
        "sets": target.sets,
        "score": round(target_score(mode, target), 2),
    }


class SetJSON(TypedDict):
    weight_kg: float | None
    reps: list[int]  # every set at the working weight
    duration_seconds: int | None


def working_set_json(session: SessionSummary) -> SetJSON:
    return {
        "weight_kg": session.working_weight_kg,
        "reps": list(session.working_reps),
        "duration_seconds": session.top_set.duration_seconds,
    }


# --- Body map ------------------------------------------------------------------------


class BodyMapMuscleJSON(TypedDict):
    group: str
    label: str
    state: MuscleState
    stale: bool  # last trained directly more than 3 weeks ago
    last_trained: str | None


class BodyMapJSON(TypedDict):
    as_of: str
    muscles: list[BodyMapMuscleJSON]


def muscle_state(summary: MuscleGroupSummary | None) -> MuscleState:
    if summary is None:
        return "never_trained"
    if not summary.trained_directly:
        return "indirect_only"
    if summary.current is None:
        return "no_status"
    return TREND_STATES[summary.current.trend]


def body_map_json(muscles: dict[str, MuscleGroupSummary], today: date) -> BodyMapJSON:
    items: list[BodyMapMuscleJSON] = []
    for group in BODY_MUSCLES:
        summary = muscles.get(group)
        items.append(
            {
                "group": group,
                "label": muscle_label(group),
                "state": muscle_state(summary),
                "stale": bool(summary and summary.trained_directly and summary.is_stale(today)),
                "last_trained": iso(summary.last_trained_directly if summary else None),
            }
        )
    return {"as_of": today.isoformat(), "muscles": items}


# --- Muscle ----------------------------------------------------------------------------

WEEKS_SHOWN = 12


class WeekExerciseJSON(TypedDict):
    id: str
    title: str
    role: Role
    trend: Trend
    date: str  # a week can hold several sessions of the same exercise
    rep_range: str | None


class WeekJSON(TypedDict):
    week_start: str
    trend: Trend
    change_pct: float | None  # the muscle's overall change that week
    exercises: list[WeekExerciseJSON]


class StrengthJSON(TypedDict):
    id: str
    title: str
    mode: TrackingMode
    role: Role
    trend: Trend | None  # latest result for this exercise
    last_trained: str
    rep_range: str | None
    latest: SetJSON
    best: SetJSON
    est_1rm_kg: float | None  # latest, for weighted exercises


class MuscleJSON(TypedDict):
    group: str
    label: str
    state: MuscleState
    stale: bool
    change_pct: float | None  # the latest judged week's overall change
    change_week: str | None  # which week that was
    weeks: list[WeekJSON]  # oldest first, most recent WEEKS_SHOWN
    exercises: list[StrengthJSON]  # primary first, then most recently trained


def week_json(week: MuscleWeek) -> WeekJSON:
    return {
        "week_start": week.week_start.isoformat(),
        "trend": week.trend,
        "change_pct": week.change_pct,
        "exercises": [
            {
                "id": c.exercise.template.id,
                "title": c.exercise.template.title,
                "role": c.role,
                "trend": c.result.trend,
                "date": c.result.session.date.isoformat(),
                "rep_range": c.result.session.rep_range,
            }
            for c in sorted(week.contributions, key=lambda c: c.result.session.date)
        ],
    }


def weeks_json(weeks: tuple[MuscleWeek, ...]) -> list[WeekJSON]:
    """The last WEEKS_SHOWN calendar weeks up to the latest trained one, including weeks
    the muscle wasn't trained at all (no exercises), so skipped weeks are visible."""
    if not weeks:
        return []
    by_start = {w.week_start: w for w in weeks}
    last = weeks[-1].week_start
    first = max(weeks[0].week_start, last - timedelta(weeks=WEEKS_SHOWN - 1))
    result: list[WeekJSON] = []
    day = first
    while day <= last:
        week = by_start.get(day)
        result.append(
            week_json(week)
            if week
            else {
                "week_start": day.isoformat(),
                "trend": Trend.INSUFFICIENT,
                "change_pct": None,
                "exercises": [],
            }
        )
        day += timedelta(weeks=1)
    return result


def strength_json(entry: StrengthEntry) -> StrengthJSON:
    latest = entry.exercise.latest
    return {
        "id": entry.exercise.template.id,
        "title": entry.exercise.template.title,
        "mode": entry.exercise.mode,
        "role": entry.role,
        "trend": latest.trend if latest else None,
        "last_trained": entry.latest.date.isoformat(),
        "rep_range": entry.latest.rep_range,
        "latest": working_set_json(entry.latest),
        "best": working_set_json(entry.best),
        "est_1rm_kg": _round(entry.latest.best_e1rm),
    }


def muscle_json(group: str, summary: MuscleGroupSummary | None, today: date) -> MuscleJSON:
    current = summary.current if summary else None
    return {
        "group": group,
        "label": muscle_label(group),
        "state": muscle_state(summary),
        "stale": bool(summary and summary.trained_directly and summary.is_stale(today)),
        "change_pct": current.change_pct if current else None,
        "change_week": current.week_start.isoformat() if current else None,
        "weeks": weeks_json(summary.weeks) if summary else [],
        "exercises": [strength_json(e) for e in summary.strength] if summary else [],
    }


# --- Exercise --------------------------------------------------------------------------


class SessionJSON(TypedDict):
    date: str
    did: SetJSON
    score: float  # e1RM / reps / assistance kg / seconds
    did_score: float  # the working set scored like a target (the chart's strength score)
    target: TargetJSON | None
    vs_target: int | None  # -1 missed, 0 hit, 1 beat
    trend: Trend
    is_best: bool


class PlanJSON(TypedDict):
    step: str
    rep_target: list[int] | None  # [bottom, top] the plan aims for, e.g. [8, 12]
    today: TargetJSON
    then: TargetJSON
    climb: list[TargetJSON]  # today, then on up to the first session at the next weight
    reps_to_go: int | None
    ahead_of_plan: bool


class EvidenceJSON(TypedDict):
    id: str
    title: str
    change_pct: float


class CapacityJSON(TypedDict):
    weight_kg: float
    change_pct: float
    evidence: list[EvidenceJSON]


class RangeJSON(TypedDict):
    rep_range: str | None
    est_1rm_kg: float | None
    trend: Trend
    change_pct: float | None
    is_best: bool
    off_best_pct: float | None
    sessions: list[SessionJSON]  # oldest first
    plan: PlanJSON
    capacity: CapacityJSON | None


class ExerciseJSON(TypedDict):
    id: str
    title: str
    mode: TrackingMode
    lower_is_better: bool  # assisted exercises: less assistance is progress
    primary_muscle: str
    secondary_muscles: list[str]
    default_range: str | None
    ranges: list[RangeJSON]


def session_json(result: SessionResult, mode: TrackingMode) -> SessionJSON:
    return {
        "date": result.session.date.isoformat(),
        "did": working_set_json(result.session),
        "score": round(result.session.score, 2),
        "did_score": round(did_score(mode, result.session), 2),
        "target": target_json(result.target, mode) if result.target else None,
        "vs_target": result.vs_target,
        "trend": result.trend,
        "is_best": result.is_best,
    }


def plan_json(plan: Plan, mode: TrackingMode) -> PlanJSON:
    bounds = PLAN_REPS.get(plan.rep_range) if plan.rep_range else None
    return {
        "step": plan.step,
        "rep_target": list(bounds) if bounds else None,
        "today": target_json(plan.today, mode),
        "then": target_json(plan.then, mode),
        "climb": [target_json(t, mode) for t in plan.climb],
        "reps_to_go": plan.reps_to_go,
        "ahead_of_plan": plan.ahead_of_plan,
    }


def range_json(rp: RangeProgress, mode: TrackingMode, titles: dict[str, str]) -> RangeJSON:
    latest = rp.results[-1]
    capacity: CapacityJSON | None = None
    if rp.capacity:
        capacity = {
            "weight_kg": rp.capacity.weight_kg,
            "change_pct": rp.capacity.change_pct,
            "evidence": [
                {"id": e.template_id, "title": titles[e.template_id], "change_pct": e.change_pct}
                for e in rp.capacity.evidence
            ],
        }
    return {
        "rep_range": rp.rep_range,
        "est_1rm_kg": _round(latest.session.best_e1rm),
        "trend": latest.trend,
        "change_pct": latest.change_pct,
        "is_best": latest.is_best,
        "off_best_pct": latest.off_best_pct,
        "sessions": [session_json(r, mode) for r in rp.results],
        "plan": plan_json(rp.plan, mode),
        "capacity": capacity,
    }


def exercise_json(progress: ExerciseProgress, titles: dict[str, str]) -> ExerciseJSON:
    template = progress.template
    default = progress.default_range
    return {
        "id": template.id,
        "title": template.title,
        "mode": progress.mode,
        "lower_is_better": progress.mode is TrackingMode.ASSISTED,
        "primary_muscle": template.primary_muscle_group,
        "secondary_muscles": list(template.secondary_muscle_groups),
        "default_range": default.rep_range if default else None,
        "ranges": [range_json(rp, progress.mode, titles) for rp in progress.ranges],
    }


# --- Exercise summaries ------------------------------------------------------------------


class ExerciseSummaryJSON(TypedDict):
    id: str
    title: str
    mode: TrackingMode
    primary_muscle: str
    rep_range: str | None  # the default range (Hypertrophy if trained in it)
    trend: Trend
    change_pct: float | None
    last: SessionJSON
    plan: PlanJSON


class ExerciseListJSON(TypedDict):
    exercises: list[ExerciseSummaryJSON]  # by primary muscle, then title


def exercise_summary_json(progress: ExerciseProgress) -> ExerciseSummaryJSON | None:
    rp = progress.default_range
    if rp is None:
        return None
    latest = rp.results[-1]
    return {
        "id": progress.template.id,
        "title": progress.template.title,
        "mode": progress.mode,
        "primary_muscle": progress.template.primary_muscle_group,
        "rep_range": rp.rep_range,
        "trend": latest.trend,
        "change_pct": latest.change_pct,
        "last": session_json(latest, progress.mode),
        "plan": plan_json(rp.plan, progress.mode),
    }


# --- Search ----------------------------------------------------------------------------


class ExerciseHitJSON(TypedDict):
    id: str
    title: str
    primary_muscle: str
    last_trained: str | None


class MuscleHitJSON(TypedDict):
    group: str
    label: str


class SearchJSON(TypedDict):
    exercises: list[ExerciseHitJSON]
    muscles: list[MuscleHitJSON]


def exercise_hit_json(progress: ExerciseProgress) -> ExerciseHitJSON:
    return {
        "id": progress.template.id,
        "title": progress.template.title,
        "primary_muscle": progress.template.primary_muscle_group,
        "last_trained": iso(progress.last_trained),
    }


# --- Status ----------------------------------------------------------------------------


class StatusJSON(TypedDict):
    has_data: bool
    synced_minutes_ago: int | None
    refreshing: bool
    refresh_failed: bool  # the latest refresh failed: data may be out of date


def _round(value: float | None) -> float | None:
    return round(value, 1) if value is not None else None
