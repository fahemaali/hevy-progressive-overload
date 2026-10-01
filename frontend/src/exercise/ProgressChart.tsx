import type { Session } from '../api/types'
import { TREND_INFO } from '../trends'
import { shortDate } from '../format'
import styles from './ProgressChart.module.css'

const WIDTH = 640
const HEIGHT = 220
const PAD = { left: 14, right: 14, top: 18, bottom: 30 }

interface Props {
  sessions: Session[]
  lowerIsBetter: boolean
  selected: number
  onSelect: (index: number) => void
}

/**
 * What you did (solid) against what the plan asked for (dashed), session by session.
 * Solid at or above dashed: following the plan. Solid rising: getting stronger.
 * No values on the axis by design; the selected session's sets are read out below.
 */
export function ProgressChart({ sessions, lowerIsBetter, selected, onSelect }: Props) {
  const xs = xPositions(sessions)
  const values = sessions.flatMap((s) =>
    s.target_score === null ? [s.score] : [s.score, s.target_score],
  )
  const y = yScale(values, lowerIsBetter)

  const actual = sessions.map((s, i) => [xs[i], y(s.score)] as const)
  const targetSegments = segments(
    sessions.map((s, i) =>
      s.target_score === null ? null : ([xs[i], y(s.target_score)] as const),
    ),
  )
  const plotBottom = HEIGHT - PAD.bottom

  return (
    <div className={styles.wrap}>
      <ul className={styles.legend} aria-label="Chart legend">
        <li>
          <svg width="22" height="8" aria-hidden="true">
            <line x1="1" y1="4" x2="21" y2="4" className={styles.actualLine} />
          </svg>
          You
        </li>
        <li>
          <svg width="22" height="8" aria-hidden="true">
            <line x1="1" y1="4" x2="21" y2="4" className={styles.targetLine} />
          </svg>
          Plan's target
        </li>
      </ul>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className={styles.chart}
        role="slider"
        tabIndex={0}
        aria-label="Sessions"
        aria-valuemin={1}
        aria-valuemax={sessions.length}
        aria-valuenow={selected + 1}
        aria-valuetext={`Session ${selected + 1} of ${sessions.length}, ${shortDate(sessions[selected].date)}`}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onSelect(Math.max(0, selected - 1))
          else if (e.key === 'ArrowRight' || e.key === 'ArrowUp')
            onSelect(Math.min(sessions.length - 1, selected + 1))
          else if (e.key === 'Home') onSelect(0)
          else if (e.key === 'End') onSelect(sessions.length - 1)
          else return
          e.preventDefault()
        }}
      >
        {[0, 0.5, 1].map((f) => {
          const gy = PAD.top + f * (plotBottom - PAD.top)
          return (
            <line
              key={f}
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={gy}
              y2={gy}
              className={styles.grid}
            />
          )
        })}

        <line
          x1={xs[selected]}
          x2={xs[selected]}
          y1={PAD.top - 6}
          y2={plotBottom}
          className={styles.crosshair}
        />

        {targetSegments.map((points, i) => (
          <path key={i} d={pathOf(points)} className={styles.targetLine} />
        ))}
        {actual.length > 1 && <path d={pathOf(actual)} className={styles.actualLine} />}

        {sessions.map((s, i) => (
          <circle
            key={i}
            cx={xs[i]}
            cy={y(s.score)}
            r={i === selected ? 9 : 6.5}
            fill={s.trend === 'new' ? 'var(--chart-actual)' : TREND_INFO[s.trend].color}
            className={styles.dot}
          />
        ))}

        {/* Hit areas: a full-height band per session, so you tap a date, not a 2px line. */}
        {sessions.map((s, i) => {
          const left = i === 0 ? 0 : (xs[i - 1] + xs[i]) / 2
          const right = i === sessions.length - 1 ? WIDTH : (xs[i] + xs[i + 1]) / 2
          return (
            <rect
              key={`hit-${i}`}
              x={left}
              y={0}
              width={Math.max(right - left, 1)}
              height={HEIGHT}
              className={styles.hit}
              onPointerEnter={() => onSelect(i)}
              onClick={() => onSelect(i)}
            >
              <title>{shortDate(s.date)}</title>
            </rect>
          )
        })}

        <text x={xs[0]} y={HEIGHT - 8} className={styles.axisLabel} textAnchor="start">
          {shortDate(sessions[0].date)}
        </text>
        {sessions.length > 1 && (
          <text x={xs[xs.length - 1]} y={HEIGHT - 8} className={styles.axisLabel} textAnchor="end">
            {shortDate(sessions[sessions.length - 1].date)}
          </text>
        )}
      </svg>
    </div>
  )
}

/** Sessions placed by date, so gaps in training show as gaps. */
function xPositions(sessions: Session[]): number[] {
  const left = PAD.left + 8
  const right = WIDTH - PAD.right - 8
  if (sessions.length === 1) return [(left + right) / 2]
  const times = sessions.map((s) => Date.parse(s.date))
  const first = times[0]
  const span = times[times.length - 1] - first
  if (span === 0) return sessions.map((_, i) => left + (i / (sessions.length - 1)) * (right - left))
  return times.map((t) => left + ((t - first) / span) * (right - left))
}

/** Maps a score to a height; for assisted exercises less is better, so the scale flips. */
function yScale(values: number[], lowerIsBetter: boolean): (v: number) => number {
  let min = Math.min(...values)
  let max = Math.max(...values)
  if (min === max) {
    min -= 1
    max += 1
  }
  const pad = (max - min) * 0.12
  min -= pad
  max += pad
  const top = PAD.top
  const bottom = HEIGHT - PAD.bottom
  return (v) => {
    const f = (v - min) / (max - min)
    return lowerIsBetter ? top + f * (bottom - top) : bottom - f * (bottom - top)
  }
}

type Point = readonly [number, number]

function segments(points: (Point | null)[]): Point[][] {
  const result: Point[][] = []
  let current: Point[] = []
  for (const p of points) {
    if (p) current.push(p)
    else if (current.length) {
      result.push(current)
      current = []
    }
  }
  if (current.length) result.push(current)
  return result.filter((seg) => seg.length > 1)
}

function pathOf(points: readonly Point[]): string {
  return points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ')
}
