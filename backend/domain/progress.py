"""Brings the rules together: progress per exercise, and per muscle group week by week."""

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, timedelta
from enum import StrEnum

from backend.domain.capacity import CapacityHint, capacity_hint
from backend.domain.metrics import RepRange, TrackingMode, tracking_mode
from backend.domain.models import ExerciseTemplate, Workout
from backend.domain.plan import Plan, next_target, plan_next
from backend.domain.sessions import SessionSummary, summarise_sessions
from backend.domain.verdicts import SessionResult, Trend, judge_session

# Hevy muscle groups with no place on a body map; their exercises are found by search.
NON_BODY_GROUPS = frozenset({"full_body", "cardio", "other"})
# A muscle not trained directly for longer than this is shown as stale.
STALE_AFTER = timedelta(weeks=3)


@dataclass(frozen=True)
class RangeProgress:
    """One progression: an exercise in one rep range (or the only one, if unranged)."""

    rep_range: RepRange | None
    results: tuple[SessionResult, ...]  # oldest first
    plan: Plan
    capacity: CapacityHint | None = None


@dataclass(frozen=True)
class ExerciseProgress:
    template: ExerciseTemplate
    mode: TrackingMode
    results: tuple[SessionResult, ...]  # every range, oldest first
    ranges: tuple[RangeProgress, ...]

    @property
    def latest(self) -> SessionResult | None:
        return self.results[-1] if self.results else None

    @property
    def last_trained(self) -> date | None:
        return self.results[-1].session.date if self.results else None

    @property
    def default_range(self) -> RangeProgress | None:
        """Strength if it's been trained in that range, otherwise whatever there is."""
        by_range = {r.rep_range: r for r in self.ranges}
        return by_range.get(RepRange.STRENGTH) or next(iter(self.ranges), None)


def analyse_all(
    templates: Iterable[ExerciseTemplate], workouts: Iterable[Workout]
) -> dict[str, ExerciseProgress]:
    """Progress for every exercise that appears in the workouts, keyed by template id."""
    workouts = list(workouts)
    performed = {ex.template_id for w in workouts for ex in w.exercises}
    progress = {t.id: analyse_exercise(t, workouts) for t in templates if t.id in performed}
    return _with_capacity(progress)


def analyse_exercise(template: ExerciseTemplate, workouts: Iterable[Workout]) -> ExerciseProgress:
    """Progress for one exercise on its own (capacity needs the others: see analyse_all)."""
    mode = tracking_mode(template)
    sessions = summarise_sessions(template, workouts)

    by_range: dict[RepRange | None, list[SessionSummary]] = {}
    for s in sessions:
        by_range.setdefault(s.rep_range, []).append(s)

    ranges = []
    for range_, range_sessions in by_range.items():
        results = _judge_with_targets(template, mode, range_sessions)
        plan = plan_next(template, results)
        assert plan is not None  # every range has at least one session
        ranges.append(RangeProgress(range_, tuple(results), plan))

    all_results = sorted(
        (r for rp in ranges for r in rp.results),
        key=lambda r: (r.session.date, r.session.workout_id, r.session.rep_range or ""),
    )
    return ExerciseProgress(template, mode, tuple(all_results), tuple(ranges))


def _judge_with_targets(
    template: ExerciseTemplate, mode: TrackingMode, sessions: list[SessionSummary]
) -> list[SessionResult]:
    """Judges each session, including against the target the plan would have set
    from the sessions before it."""
    results: list[SessionResult] = []
    for session in sessions:
        target = next_target(template, mode, results)[1] if results else None
        results.append(judge_session(mode, session, [r.session for r in results], target))
    return results


def _with_capacity(progress: dict[str, ExerciseProgress]) -> dict[str, ExerciseProgress]:
    weighted = [
        (p.template, list(p.results)) for p in progress.values() if p.mode is TrackingMode.LOAD
    ]
    updated = {}
    for key, p in progress.items():
        if p.mode is TrackingMode.LOAD:
            ranges = tuple(
                RangeProgress(
                    rp.rep_range,
                    rp.results,
                    rp.plan,
                    capacity_hint(p.template, list(rp.results), weighted),
                )
                for rp in p.ranges
            )
            p = ExerciseProgress(p.template, p.mode, p.results, ranges)
        updated[key] = p
    return updated


# --- Muscle groups ----------------------------------------------------------------


class Role(StrEnum):
    PRIMARY = "primary"
    SECONDARY = "secondary"


# How much an exercise counts towards a muscle's weekly status.
ROLE_WEIGHTS = {Role.PRIMARY: 1.0, Role.SECONDARY: 0.5}
# A single exercise's change counts at most this much (either way) in a muscle's %.
CHANGE_CAP_PCT = 25.0


@dataclass(frozen=True)
class Contribution:
    exercise: ExerciseProgress
    role: Role
    result: SessionResult


@dataclass(frozen=True)
class MuscleWeek:
    week_start: date  # Monday
    trend: Trend  # INSUFFICIENT unless trained directly and something could be judged
    contributions: tuple[Contribution, ...]

    @property
    def trained_directly(self) -> bool:
        return any(c.role is Role.PRIMARY for c in self.contributions)

    @property
    def change_pct(self) -> float | None:
        """The muscle's overall change this week: the average of its judged exercises'
        changes against their recent level (indirect ones count half; for assisted
        exercises less is better, so the sign flips). Each change is capped at
        ±CHANGE_CAP_PCT so one big early jump can't dominate. None when the week
        couldn't be judged."""
        if self.trend not in (Trend.UP, Trend.FLAT, Trend.DOWN):
            return None
        total = weight = 0.0
        for c in self.contributions:
            change = c.result.change_pct
            if c.result.trend not in (Trend.UP, Trend.FLAT, Trend.DOWN) or change is None:
                continue
            if c.exercise.mode is TrackingMode.ASSISTED:
                change = -change
            capped = max(-CHANGE_CAP_PCT, min(CHANGE_CAP_PCT, change))
            total += capped * ROLE_WEIGHTS[c.role]
            weight += ROLE_WEIGHTS[c.role]
        return round(total / weight, 1) if weight else None


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
    def trained_directly(self) -> bool:
        """False for muscles only ever trained indirectly (e.g. calves): not tracked."""
        return any(w.trained_directly for w in self.weeks)

    @property
    def current(self) -> MuscleWeek | None:
        """The most recent week that could be judged."""
        judged = [w for w in self.weeks if w.trend is not Trend.INSUFFICIENT]
        return judged[-1] if judged else None

    @property
    def last_trained_directly(self) -> date | None:
        dates = [
            c.result.session.date
            for w in self.weeks
            for c in w.contributions
            if c.role is Role.PRIMARY
        ]
        return max(dates, default=None)

    def is_stale(self, as_of: date) -> bool:
        last = self.last_trained_directly
        return last is not None and as_of - last > STALE_AFTER


def muscle_group_summaries(progress: Iterable[ExerciseProgress]) -> list[MuscleGroupSummary]:
    """Every body muscle trained directly or indirectly, sorted by name."""
    trained = [p for p in progress if p.results]
    groups = sorted(
        (
            {p.template.primary_muscle_group for p in trained}
            | {g for p in trained for g in p.template.secondary_muscle_groups}
        )
        - NON_BODY_GROUPS
    )
    return [_summarise_group(group, trained) for group in groups]


def _summarise_group(group: str, trained: list[ExerciseProgress]) -> MuscleGroupSummary:
    roles = {p.template.id: role for p in trained if (role := _role(p.template, group))}
    involved = [p for p in trained if p.template.id in roles]

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
    """Weighted strict majority: ▲ if more than half the judged weight progressed,
    ▼ if more than half declined, otherwise not progressing. Only weeks with direct
    training are judged, and new exercises don't count until their second session."""
    if not any(c.role is Role.PRIMARY for c in contributions):
        return Trend.INSUFFICIENT
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
