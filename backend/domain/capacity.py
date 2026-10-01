"""
Capacity: evidence from other exercises that you could lift more on this one.

Weights are never compared across exercises. Instead: how much have your other
exercises for the same muscle improved, each against itself, since you last
did this one? Apply that improvement to this exercise's working weight.
"""

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date
from math import floor

from backend.domain.metrics import RepRange, weight_increment
from backend.domain.models import ExerciseTemplate
from backend.domain.verdicts import SessionResult

# How much another exercise's improvement counts, by how it trains the muscle.
PRIMARY_EVIDENCE_WEIGHT = 1.0
SECONDARY_EVIDENCE_WEIGHT = 0.5
# Never suggest more than this jump in one go, however strong the evidence: trainer
# guidelines put a single load increase at 2–10%. New exercises often show huge early
# gains (technique, not strength) that would otherwise suggest unsafe jumps.
MAX_JUMP_PCT = 10.0


@dataclass(frozen=True)
class Evidence:
    template_id: str
    change_pct: float  # improvement since this exercise was last done
    weight: float  # how much it counted


@dataclass(frozen=True)
class CapacityHint:
    weight_kg: float  # suggested weight, capped at MAX_JUMP_PCT (or one increment)
    change_pct: float  # weighted average improvement of the other exercises (uncapped)
    evidence: tuple[Evidence, ...]


def capacity_hint(
    template: ExerciseTemplate,
    results: list[SessionResult],
    others: Iterable[tuple[ExerciseTemplate, list[SessionResult]]],
) -> CapacityHint | None:
    """`results`: this weighted exercise in one rep range, oldest first.
    `others`: other weighted exercises with all their results, oldest first."""
    if not results:
        return None
    last = results[-1].session
    if last.working_weight_kg is None:
        return None

    muscle = template.primary_muscle_group
    evidence = []
    for other, other_results in others:
        if other.id == template.id:
            continue
        if other.primary_muscle_group == muscle:
            counts = PRIMARY_EVIDENCE_WEIGHT
        elif muscle in other.secondary_muscle_groups:
            counts = SECONDARY_EVIDENCE_WEIGHT
        else:
            continue
        change = _change_since(other_results, last.date, last.rep_range)
        if change is not None:
            evidence.append(Evidence(other.id, change, counts))

    if not evidence:
        return None
    total = sum(e.weight for e in evidence)
    average = round(sum(e.change_pct * e.weight for e in evidence) / total, 1)
    if average <= 0:
        return None

    step = weight_increment(template.equipment)
    current = last.working_weight_kg
    if current * average / 100 < step:
        return None  # the evidence doesn't add up to even one increment
    # Capped, but always at least one increment: the smallest jump that's possible.
    steps = max(1, floor(current * min(average, MAX_JUMP_PCT) / 100 / step))
    return CapacityHint(current + steps * step, average, tuple(evidence))


def _change_since(
    results: list[SessionResult], since: date, preferred: RepRange | None
) -> float | None:
    """How much an exercise improved after `since`: its latest session vs its last
    session on or before that date, in the same rep range. Prefers `preferred`."""
    ranges = sorted({r.session.rep_range for r in results}, key=lambda r: r != preferred)
    for range_ in ranges:
        in_range = [r.session for r in results if r.session.rep_range == range_]
        before = [s for s in in_range if s.date <= since]
        after = [s for s in in_range if s.date > since]
        if before and after and before[-1].score > 0:
            return round((after[-1].score - before[-1].score) / before[-1].score * 100, 1)
    return None
