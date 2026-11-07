"""
The next session: which half of the body is due, the muscles it trains, and for each
muscle your favourite exercise plus a few alternatives, each with the plan's target.

Training alternates between two halves (A and B days) that together cover the whole
body. The next session is the other half from the last one you did. See REQUIREMENTS.md,
"Next session".
"""

import re
from collections import Counter
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import date, timedelta
from enum import StrEnum
from statistics import median

from backend.domain.metrics import RepRange, TrackingMode
from backend.domain.models import ExerciseTemplate, Routine, Workout
from backend.domain.plan import is_easier
from backend.domain.progress import ExerciseProgress, MuscleGroupSummary, RangeProgress
from backend.domain.sessions import SessionSummary
from backend.domain.targets import Target
from backend.domain.verdicts import Trend


class Half(StrEnum):
    A = "a"
    B = "b"


# The split, from the original Day 1 a and Day 2 b routines, in the order they're trained.
# Glutes and core come up in both halves.
MUSCLES: dict[Half, tuple[str, ...]] = {
    Half.A: ("hamstrings", "glutes", "chest", "lats", "biceps", "lower_back", "abdominals"),
    Half.B: ("quadriceps", "glutes", "upper_back", "shoulders", "triceps", "abdominals"),
}
# Optional extras, added when they're overdue and there's time.
EXTRAS: dict[Half, tuple[str, ...]] = {
    Half.A: (),
    Half.B: ("abductors", "adductors", "calves"),
}
# Prehab and mobility exercises: Hevy files them under "other".
MOBILITY_GROUP = "other"

# Muscles that belong to one half only: these decide which half a workout was.
_ONLY_IN: dict[Half, frozenset[str]] = {
    Half.A: frozenset(MUSCLES[Half.A]) - frozenset(MUSCLES[Half.B]),
    Half.B: (frozenset(MUSCLES[Half.B]) | frozenset(EXTRAS[Half.B])) - frozenset(MUSCLES[Half.A]),
}

MAX_ALTERNATIVES = 3
# An extra muscle is added once it hasn't been trained directly for this long.
EXTRA_AFTER = timedelta(days=10)
# The next session pairs with the last one only if it was this recent; after a longer gap
# it's a fresh start with the whole half.
PAIR_WITHIN = timedelta(days=7)
# Back after this long away from an exercise: match last time rather than push on.
BREAK_AFTER = timedelta(weeks=3)

# How long a session may be, and how long each exercise takes when there's no history.
TIME_LIMIT_MINUTES = 90
DEFAULT_MINUTES_PER_EXERCISE = 8.0
# Workouts longer than this, or much longer than usual, were left running by mistake.
LONGEST_REAL_WORKOUT_MINUTES = 120
OUTLIER_FACTOR = 1.5

# A routine named like "Day 3 a" or "Day 4 b 15th Sep": a lone "a" or "b" names its half.
_HALF_IN_NAME = re.compile(r"(?:^|\s)([ab])(?:\s|$)", re.IGNORECASE)

# Lagging muscles go first, while you're fresh.
_TREND_ORDER: dict[Trend | None, int] = {Trend.DOWN: 0, Trend.FLAT: 1}


@dataclass(frozen=True)
class Option:
    exercise: ExerciseProgress
    favourite: bool
    target: Target


@dataclass(frozen=True)
class MuscleSlot:
    group: str
    summary: MuscleGroupSummary | None
    extra: bool  # an optional extra: left out on a low energy day
    options: tuple[Option, ...]  # the main option first, then the alternatives


@dataclass(frozen=True)
class NextSession:
    half: Half
    muscles: tuple[MuscleSlot, ...]
    mobility: tuple[Option, ...]


def plan_next_session(
    progress: Mapping[str, ExerciseProgress],
    muscles: Mapping[str, MuscleGroupSummary],
    workouts: Iterable[Workout],
    routines: Iterable[Routine],
    today: date,
) -> NextSession:
    workouts = sorted(workouts, key=lambda w: (w.date, w.id))
    templates = {p.template.id: p.template for p in progress.values()}
    routine_titles = {r.id: r.title for r in routines}
    halves = {
        w.id: workout_half(w, templates, routine_titles.get(w.routine_id or "")) for w in workouts
    }
    half = next_half(workouts, halves)

    # How many workouts each exercise was in: on this half's days, and at all.
    done_in_half = Counter(i for w in workouts if halves[w.id] is half for i in _exercise_ids(w))
    done_at_all = Counter(i for w in workouts for i in _exercise_ids(w))

    def options(group: str) -> tuple[Option, ...]:
        candidates = [
            p for p in progress.values() if p.template.primary_muscle_group == group and p.ranges
        ]
        return _options(candidates, done_in_half, done_at_all, today)

    per_exercise = minutes_per_exercise(workouts)

    def fits(count: int) -> bool:
        return count * per_exercise <= TIME_LIMIT_MINUTES

    slots = [
        MuscleSlot(group, muscles.get(group), False, opts)
        for group in session_muscles(half, workouts, templates, today)
        if (opts := options(group))
    ]
    while len(slots) > 1 and not fits(len(slots)):
        slots.pop()  # catching up on too much at once: the last ones wait for next time
    slots.sort(key=lambda s: _TREND_ORDER.get(_trend(s.summary), len(_TREND_ORDER)))

    for group in EXTRAS[half]:
        summary = muscles.get(group)
        last = summary.last_trained_directly if summary else None
        overdue = last is None or today - last >= EXTRA_AFTER
        if overdue and fits(len(slots) + 1) and (opts := options(group)):
            slots.append(MuscleSlot(group, summary, True, opts))

    mobility = sorted(
        (
            p
            for p in progress.values()
            if p.template.primary_muscle_group == MOBILITY_GROUP
            and p.ranges
            and done_in_half[p.template.id]
        ),
        key=lambda p: (-done_in_half[p.template.id], p.template.title),
    )
    return NextSession(
        half,
        tuple(slots),
        tuple(Option(p, False, session_target(p, today)) for p in mobility),
    )


def session_muscles(
    half: Half,
    workouts: list[Workout],
    templates: Mapping[str, ExerciseTemplate],
    today: date,
) -> list[str]:
    """The muscles for the next session, so that it and your last session cover the whole
    body between them: the half's muscles, minus any your last session already trained,
    plus any of the other half's that your last session missed. Muscles in both halves
    (glutes, core) are always included. After more than PAIR_WITHIN, just the half."""
    if not workouts or today - workouts[-1].date > PAIR_WITHIN:
        return list(MUSCLES[half])
    last = {
        t.primary_muscle_group
        for ex in workouts[-1].exercises
        if (t := templates.get(ex.template_id))
    }
    other = Half.B if half is Half.A else Half.A
    own = [g for g in MUSCLES[half] if not (g in _ONLY_IN[half] and g in last)]
    missed = [g for g in MUSCLES[other] if g in _ONLY_IN[other] and g not in last]
    return own + missed


def workout_half(
    workout: Workout,
    templates: Mapping[str, ExerciseTemplate],
    routine_title: str | None = None,
) -> Half | None:
    """Which half a workout trained, judged by its exercises' main muscles, so swapping
    exercises or renaming routines doesn't matter. An even mix goes by the routine's
    name ("Day 3 a"); None if that doesn't say either."""
    votes = Counter(
        half
        for ex in workout.exercises
        if (t := templates.get(ex.template_id))
        for half, only in _ONLY_IN.items()
        if t.primary_muscle_group in only
    )
    if votes[Half.A] == votes[Half.B]:
        named = _HALF_IN_NAME.search(routine_title or "")
        return Half(named.group(1).lower()) if named else None
    return Half.A if votes[Half.A] > votes[Half.B] else Half.B


def next_half(workouts: list[Workout], halves: Mapping[str, Half | None]) -> Half:
    """The other half from the latest workout that was clearly one or the other."""
    for w in reversed(workouts):
        if (half := halves[w.id]) is not None:
            return Half.B if half is Half.A else Half.A
    return Half.A


def minutes_per_exercise(workouts: Iterable[Workout]) -> float:
    """How long an exercise typically takes, from how long your workouts lasted,
    ignoring ones that were left running."""
    real = [
        (w.duration_minutes, len(w.exercises))
        for w in workouts
        if w.duration_minutes and w.exercises and w.duration_minutes <= LONGEST_REAL_WORKOUT_MINUTES
    ]
    if not real:
        return DEFAULT_MINUTES_PER_EXERCISE
    usual = median(minutes for minutes, _ in real)
    return median(minutes / count for minutes, count in real if minutes <= usual * OUTLIER_FACTOR)


def session_target(p: ExerciseProgress, today: date) -> Target:
    """The plan's target, in the rep range you last did the exercise in. Back after a
    break, match last time instead, unless the plan already asks for less."""
    range_ = latest_range(p)
    latest = range_.results[-1].session
    if today - latest.date >= BREAK_AFTER:
        last_time = repeat_of(p.mode, latest)
        if is_easier(p.mode, last_time, range_.plan.today):
            return last_time
    return range_.plan.today


def latest_range(p: ExerciseProgress) -> RangeProgress:
    """The rep range you last did the exercise in. A session with sets in both counts
    as the one with more sets (Hypertrophy if even)."""
    last_day = max(r.results[-1].session.date for r in p.ranges)
    return max(
        (r for r in p.ranges if r.results[-1].session.date == last_day),
        key=lambda r: (r.results[-1].session.set_count, r.rep_range == RepRange.STRENGTH),
    )


def repeat_of(mode: TrackingMode, session: SessionSummary) -> Target:
    """A target that repeats what a session did."""
    sets = len(session.working_reps) or 1
    if mode is TrackingMode.REPS:
        return Target(reps=int(session.score), sets=sets)
    if mode is TrackingMode.DURATION:
        return Target(duration_seconds=int(session.score))
    return Target(session.working_weight_kg, min(session.working_reps), sets=sets)


def _options(
    candidates: list[ExerciseProgress],
    done_in_half: Counter[str],
    done_at_all: Counter[str],
    today: date,
) -> tuple[Option, ...]:
    """Your favourite (the one you do most on this half's days), then the runner-up,
    then the ones you've gone longest without, so variety comes back round."""
    if not candidates:
        return ()

    def last(p: ExerciseProgress) -> date:
        return p.last_trained or date.min

    ranked = sorted(
        candidates,
        key=lambda p: (done_in_half[p.template.id], done_at_all[p.template.id], last(p)),
        reverse=True,
    )
    favourite, *rest = ranked
    alternatives = rest[:1] + sorted(rest[1:], key=last)[: MAX_ALTERNATIVES - 1]
    return (
        Option(favourite, True, session_target(favourite, today)),
        *(Option(p, False, session_target(p, today)) for p in alternatives),
    )


def _trend(summary: MuscleGroupSummary | None) -> Trend | None:
    current = summary.current if summary else None
    return current.trend if current else None


def _exercise_ids(workout: Workout) -> set[str]:
    """Each exercise once per workout, however many times it was logged."""
    return {ex.template_id for ex in workout.exercises}
