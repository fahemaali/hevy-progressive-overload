"""Brings the rules together: progress per exercise, and per muscle group week by week."""

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, timedelta
from enum import StrEnum

from backend.domain.metrics import TrackingMode, tracking_mode
from backend.domain.models import ExerciseTemplate, Workout
from backend.domain.sessions import SessionSummary, summarise_sessions
from backend.domain.suggestions import Suggestion, suggest_next
from backend.domain.verdicts import SessionResult, Trend, judge_sessions


@dataclass(frozen=True)
class ExerciseProgress:
    template: ExerciseTemplate
    mode: TrackingMode
    results: tuple[SessionResult, ...]  # one per session (and rep range), oldest first
    suggestions: tuple[Suggestion, ...]

    @property
    def latest(self) -> SessionResult | None:
        return self.results[-1] if self.results else None

    @property
    def last_trained(self) -> date | None:
        return self.results[-1].session.date if self.results else None


def analyse_exercise(template: ExerciseTemplate, workouts: Iterable[Workout]) -> ExerciseProgress:
    sessions = summarise_sessions(template, workouts)
    mode = tracking_mode(template)
    return ExerciseProgress(
        template=template,
        mode=mode,
        results=tuple(judge_sessions(mode, sessions)),
        suggestions=tuple(suggest_next(template, sessions)),
    )


def analyse_all(
    templates: Iterable[ExerciseTemplate], workouts: Iterable[Workout]
) -> dict[str, ExerciseProgress]:
    """Progress for every exercise that appears in the workouts, keyed by template id."""
    workouts = list(workouts)
    performed = {ex.template_id for w in workouts for ex in w.exercises}
    return {t.id: analyse_exercise(t, workouts) for t in templates if t.id in performed}


# --- Muscle groups ----------------------------------------------------------------


class Role(StrEnum):
    PRIMARY = "primary"
    SECONDARY = "secondary"


# How much an exercise counts towards a muscle's weekly status.
ROLE_WEIGHTS = {Role.PRIMARY: 1.0, Role.SECONDARY: 0.5}


@dataclass(frozen=True)
class Contribution:
    exercise: ExerciseProgress
    role: Role
    result: SessionResult


@dataclass(frozen=True)
class MuscleWeek:
    week_start: date  # Monday
    trend: Trend
    contributions: tuple[Contribution, ...]


@dataclass(frozen=True)
class StrengthEntry:
    """An exercise's latest working set for a muscle, alongside the best in that rep range."""

    exercise: ExerciseProgress
    role: Role
    latest: SessionSummary
    best: SessionSummary


@dataclass(frozen=True)
class MuscleGroupSummary:
    group: str
    weeks: tuple[MuscleWeek, ...]  # oldest first; only weeks the muscle was trained
    strength: tuple[StrengthEntry, ...]  # primary first, then most recently trained

    @property
    def current(self) -> MuscleWeek | None:
        """The most recent week that could be judged."""
        judged = [w for w in self.weeks if w.trend is not Trend.INSUFFICIENT]
        return judged[-1] if judged else None


def muscle_group_summaries(progress: Iterable[ExerciseProgress]) -> list[MuscleGroupSummary]:
    tracked = [p for p in progress if p.mode is not TrackingMode.UNTRACKED and p.results]
    groups = sorted(
        {p.template.primary_muscle_group for p in tracked}
        | {g for p in tracked for g in p.template.secondary_muscle_groups}
    )
    return [_summarise_group(group, tracked) for group in groups]


def _summarise_group(group: str, tracked: list[ExerciseProgress]) -> MuscleGroupSummary:
    roles = {p.template.id: role for p in tracked if (role := _role(p.template, group))}
    involved = [p for p in tracked if p.template.id in roles]

    by_week: dict[date, list[Contribution]] = {}
    for p in involved:
        for result in p.results:
            week = _week_start(result.session.date)
            by_week.setdefault(week, []).append(Contribution(p, roles[p.template.id], result))

    weeks = tuple(
        MuscleWeek(week, _week_trend(contributions), tuple(contributions))
        for week, contributions in sorted(by_week.items())
    )
    strength = sorted(
        (_strength_entry(p, roles[p.template.id]) for p in involved),
        key=lambda e: (e.role is not Role.PRIMARY, -e.latest.date.toordinal()),
    )
    return MuscleGroupSummary(group, weeks, tuple(strength))


def _role(template: ExerciseTemplate, group: str) -> Role | None:
    if template.primary_muscle_group == group:
        return Role.PRIMARY
    if group in template.secondary_muscle_groups:
        return Role.SECONDARY
    return None


def _week_start(day: date) -> date:
    return day - timedelta(days=day.weekday())


def _week_trend(contributions: list[Contribution]) -> Trend:
    """Weighted strict majority: ▲ if more than half the judged weight beat their
    recent level, ▼ if more than half fell below it, otherwise not progressing.
    New exercises don't count until their second session."""
    weights = {Trend.UP: 0.0, Trend.FLAT: 0.0, Trend.DOWN: 0.0}
    for c in contributions:
        if c.result.trend in weights:
            weights[c.result.trend] += ROLE_WEIGHTS[c.role]
    judged = sum(weights.values())
    if judged == 0:
        return Trend.INSUFFICIENT
    if weights[Trend.UP] * 2 > judged:
        return Trend.UP
    if weights[Trend.DOWN] * 2 > judged:
        return Trend.DOWN
    return Trend.FLAT


def _strength_entry(p: ExerciseProgress, role: Role) -> StrengthEntry:
    latest = p.results[-1].session
    same_range = [r.session for r in p.results if r.session.rep_range == latest.rep_range]
    if p.mode is TrackingMode.ASSISTED:
        best = min(same_range, key=lambda s: s.score)
    else:
        best = max(same_range, key=lambda s: s.score)
    return StrengthEntry(p, role, latest, best)
