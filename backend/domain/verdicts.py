"""Judges each session against your recent level, your best and the plan's target."""

from dataclasses import dataclass
from enum import StrEnum
from statistics import median

from backend.domain.metrics import TrackingMode
from backend.domain.sessions import SessionSummary
from backend.domain.targets import Target, compare_to_target, target_score

# "Recent level" is the median of up to this many earlier sessions in the same rep range.
RECENT_SESSIONS = 3
# Changes within this band (in either direction) count as not progressing.
FLAT_BAND_PCT = 2.0


class Trend(StrEnum):
    UP = "up"
    FLAT = "flat"  # shown as "not progressing": a warning sign
    DOWN = "down"
    NEW = "new"  # first session in this rep range: sets the baseline
    INSUFFICIENT = "insufficient"  # nothing that can be judged yet


@dataclass(frozen=True)
class SessionResult:
    session: SessionSummary
    trend: Trend
    change_pct: float | None  # vs recent level; for assistance, negative is good
    is_best: bool  # beats every earlier session in this rep range
    off_best_pct: float | None  # how far short of the best earlier session (0 = matched)
    target: Target | None  # what the plan asked for; None for a first session
    target_score: float | None  # the target in score units, for charting
    vs_target: int | None  # 1 beat, 0 matched, -1 missed

    @property
    def hit_target(self) -> bool:
        return self.vs_target is not None and self.vs_target >= 0

    @property
    def ahead_of_target(self) -> bool:
        return self.vs_target == 1


def judge_session(
    mode: TrackingMode,
    session: SessionSummary,
    earlier: list[SessionSummary],
    target: Target | None,
) -> SessionResult:
    """`earlier` holds the sessions before this one in the same rep range, oldest first."""
    vs_target = compare_to_target(mode, session, target) if target else None
    score_target = target_score(mode, target) if target else None

    if not earlier:
        return SessionResult(session, Trend.NEW, None, False, None, target, score_target, vs_target)

    lower_is_better = mode is TrackingMode.ASSISTED
    score = session.score
    recent = median(e.score for e in earlier[-RECENT_SESSIONS:])
    best = min(e.score for e in earlier) if lower_is_better else max(e.score for e in earlier)

    change_pct = _pct_change(score, recent)
    if change_pct is None:
        trend = Trend.DOWN  # recent level was 0 kg assistance; any assistance is a step back
    else:
        improvement = -change_pct if lower_is_better else change_pct
        if improvement > FLAT_BAND_PCT:
            trend = Trend.UP
        elif improvement < -FLAT_BAND_PCT:
            trend = Trend.DOWN
        else:
            trend = Trend.FLAT

    is_best = score < best if lower_is_better else score > best
    off_best_pct = None if is_best else _shortfall_pct(score, best, lower_is_better)
    return SessionResult(
        session, trend, change_pct, is_best, off_best_pct, target, score_target, vs_target
    )


def _pct_change(new: float, old: float) -> float | None:
    """Percentage change, rounded to the precision shown to the user so the arrow
    always agrees with the number on screen. None when `old` is 0."""
    if old == 0:
        return 0.0 if new == 0 else None
    return round((new - old) / old * 100, 1)


def _shortfall_pct(score: float, best: float, lower_is_better: bool) -> float | None:
    change = _pct_change(score, best)
    if change is None:
        return None
    return max(0.0, change if lower_is_better else -change)
