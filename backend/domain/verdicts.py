"""Judges each session of an exercise against your recent level and your best."""

from dataclasses import dataclass
from enum import StrEnum
from statistics import median

from backend.domain.metrics import REP_RANGE_LABELS, RepRange, TrackingMode
from backend.domain.sessions import SessionSummary

# "Recent level" is the median of up to this many earlier sessions in the same rep range.
RECENT_SESSIONS = 3
# Changes within this band (in either direction) count as not progressing.
FLAT_BAND_PCT = 2.0

METRIC_LABELS = {
    TrackingMode.LOAD: "e1RM",
    TrackingMode.REPS: "Best set",
    TrackingMode.ASSISTED: "Assistance",
    TrackingMode.DURATION: "Longest hold",
}


class Trend(StrEnum):
    UP = "up"
    FLAT = "flat"
    DOWN = "down"
    NEW = "new"  # first session in this rep range: sets the baseline
    INSUFFICIENT = "insufficient"  # nothing that can be judged yet
    UNTRACKED = "untracked"  # exercise type isn't measured


TREND_LABELS = {
    Trend.UP: "Progressing",
    Trend.FLAT: "Not progressing",
    Trend.DOWN: "Declining",
    Trend.NEW: "New baseline",
    Trend.INSUFFICIENT: "Not enough data yet",
    Trend.UNTRACKED: "Not tracked",
}


@dataclass(frozen=True)
class SessionResult:
    session: SessionSummary
    trend: Trend
    change_pct: float | None  # vs recent median; for assistance, negative is good
    is_best: bool  # beats every earlier session in this rep range
    off_best_pct: float | None  # how far short of the best earlier session (0 = matched it)
    reason: str


def judge_sessions(mode: TrackingMode, sessions: list[SessionSummary]) -> list[SessionResult]:
    """A result for every session, each judged only against sessions before it.

    `sessions` must be oldest first, as returned by summarise_sessions.
    """
    return [
        _judge(mode, session, [e for e in sessions[:i] if e.rep_range == session.rep_range])
        for i, session in enumerate(sessions)
    ]


def _judge(
    mode: TrackingMode, session: SessionSummary, earlier: list[SessionSummary]
) -> SessionResult:
    label = _label(mode, session.rep_range)
    if not earlier:
        return SessionResult(
            session, Trend.NEW, None, False, None, f"First {label} session: sets the baseline"
        )

    lower_is_better = mode is TrackingMode.ASSISTED
    score = session.score
    recent = median(e.score for e in earlier[-RECENT_SESSIONS:])
    best = min(e.score for e in earlier) if lower_is_better else max(e.score for e in earlier)

    change_pct = _pct_change(score, recent)
    if change_pct is None:
        # Recent level was 0 kg assistance; any assistance now is a step back.
        trend = Trend.DOWN
        main = f"{label} up from 0 kg to {score:g} kg"
    else:
        improvement = -change_pct if lower_is_better else change_pct
        if improvement > FLAT_BAND_PCT:
            trend = Trend.UP
        elif improvement < -FLAT_BAND_PCT:
            trend = Trend.DOWN
        else:
            trend = Trend.FLAT
        main = _describe_change(label, change_pct)

    is_best = score < best if lower_is_better else score > best
    off_best_pct = None if is_best else _shortfall_pct(score, best, lower_is_better)
    if is_best:
        main += " · new best"
    elif off_best_pct:
        main += f" · {off_best_pct}% off your best"
    return SessionResult(session, trend, change_pct, is_best, off_best_pct, main)


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


def _describe_change(label: str, change_pct: float) -> str:
    if change_pct == 0:
        return f"{label} unchanged vs your recent level"
    direction = "up" if change_pct > 0 else "down"
    return f"{label} {direction} {abs(change_pct)}% vs your recent level"


def _label(mode: TrackingMode, range_: RepRange | None) -> str:
    metric = METRIC_LABELS[mode]
    return f"{REP_RANGE_LABELS[range_]} {metric}" if range_ else metric
