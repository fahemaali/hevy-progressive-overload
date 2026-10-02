import { useLayoutEffect, useRef } from 'react'
import styles from './ColumnLineChart.module.css'

export interface Column {
  key: string
  label?: [string, string] // two lines under the column, e.g. ['16', 'Sept']
}

export interface Line {
  values: (number | null)[] // one per column; null leaves a gap
  variant: 'actual' | 'target' | 'trend'
  // Where the line comes in from, left of the first column: the corner where the axes
  // meet, or a value (e.g. history from before the first column).
  from?: 'origin' | number
  bridgeGaps?: boolean // join across columns with no value, as a dashed stretch
}

export interface Dot {
  column: number
  value: number
  color: string
  hollow?: boolean // a planned point
  label?: string // a few characters above the dot, e.g. '29×8'
}

interface Props {
  columns: Column[]
  lines: Line[]
  dots: Dot[]
  label: string // what the chart shows, for screen readers
  height?: number
  invert?: boolean // lower is better: the scale flips so "up" always means progress
  zeroLine?: boolean // for changes: a baseline at 0, and a range balanced around it
  // Value labels and gridlines on the left, with an optional title running up beside them
  // (`hint` shows on hover).
  yAxis?: { format: (value: number) => string; title?: string; hint?: string }
  highlight?: number // a column whose dot is drawn larger
  callout?: string // a short label above the highlighted column's top dot
  // Columns never get narrower than this (px): with more columns than fit, the plot
  // scrolls sideways while the y-axis stays put.
  minColumnWidth?: number
  startAt?: number // a column to bring into view when the chart first appears
}

// Where the start column sits in the visible width when the chart opens (40% across),
// so a little history shows to its left and what's ahead to its right.
const START_POSITION = 0.4

const TICK_COUNT = 4
// The y-axis always spans at least this fraction of the values (20%).
const MIN_SPAN = 0.2

/**
 * Equal-width columns with lines through them. Lines and gridlines are drawn in a
 * stretched SVG (strokes keep their width); dots and labels are HTML laid over it,
 * so they stay round and crisp at any size. Values are also given in text nearby
 * (cards and the session table), so the chart never gates them.
 */
export function ColumnLineChart({
  columns,
  lines,
  dots,
  label,
  height = 160,
  invert = false,
  zeroLine = false,
  yAxis,
  highlight,
  callout,
  minColumnWidth,
  startAt,
}: Props) {
  const scroller = useRef<HTMLDivElement>(null)
  const n = columns.length
  const x = (i: number) => ((i + 0.5) / n) * 100
  const values = [
    ...lines.flatMap((l) => [...l.values, typeof l.from === 'number' ? l.from : null]),
    ...dots.map((d) => d.value),
  ]
  const { y, ticks } = scale(values, { invert, zeroLine, withTicks: Boolean(yAxis) })
  const top = dots
    .filter((d) => d.column === highlight)
    .reduce<Dot | null>((best, d) => (!best || y(d.value) < y(best.value) ? d : best), null)
  const hasLabels = columns.some((c) => c.label)
  const hasDotLabels = dots.some((d) => d.label)
  // Just wide enough for the longest number on the axis.
  const axisChars = yAxis ? Math.max(...ticks.map((t) => yAxis.format(t).length)) : 0

  useLayoutEffect(() => {
    const el = scroller.current
    if (!el || startAt === undefined) return
    const column = el.scrollWidth / n
    const wanted = (startAt + 0.5) * column - el.clientWidth * START_POSITION
    el.scrollLeft = Math.round(wanted / column) * column // a whole column at the left edge
  }, [startAt, n])

  return (
    <figure className={styles.figure} aria-label={label}>
      <div
        className={styles.chart}
        data-scroll={minColumnWidth ? true : undefined}
        data-dot-labels={hasDotLabels || undefined}
      >
        {yAxis?.title && (
          <span className={styles.yTitle} style={{ height }} title={yAxis.hint} aria-hidden="true">
            {yAxis.title}
          </span>
        )}
        {yAxis && (
          <div
            className={styles.yAxis}
            style={{ height, width: `calc(${axisChars}ch + 8px)` }}
            aria-hidden="true"
          >
            {ticks.map((t) => (
              <span key={t} className={styles.tick} style={{ top: `${y(t)}%` }}>
                {yAxis.format(t)}
              </span>
            ))}
          </div>
        )}

        <div
          ref={scroller}
          className={styles.body}
          // Scrollable regions need to be reachable by keyboard.
          tabIndex={minColumnWidth ? 0 : undefined}
        >
          <div
            className={styles.track}
            style={minColumnWidth ? { minWidth: n * minColumnWidth } : undefined}
          >
            <div className={styles.plot} style={{ height }}>
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className={styles.svg}
                aria-hidden="true"
              >
                {ticks.map((t) => (
                  <line key={t} x1="0" x2="100" y1={y(t)} y2={y(t)} className={styles.grid} />
                ))}
                {zeroLine && <line x1="0" x2="100" y1={y(0)} y2={y(0)} className={styles.grid} />}
                {yAxis && (
                  <>
                    <line x1="0" x2="0" y1="0" y2="100" className={styles.axis} />
                    <line x1="0" x2="100" y1="100" y2="100" className={styles.axis} />
                  </>
                )}
                {lines.flatMap((line, li) =>
                  segments(line.values).map((seg, si) => (
                    <polyline
                      key={`${li}-${si}`}
                      points={[
                        ...(si === 0 ? entry(line, y) : []),
                        ...seg.map((i) => `${x(i)},${y(line.values[i]!)}`),
                      ].join(' ')}
                      className={styles[line.variant]}
                    />
                  )),
                )}
                {lines.flatMap((line, li) =>
                  line.bridgeGaps
                    ? gaps(line.values).map(([from, to]) => (
                        <line
                          key={`${li}-gap-${from}`}
                          x1={x(from)}
                          y1={y(line.values[from]!)}
                          x2={x(to)}
                          y2={y(line.values[to]!)}
                          className={styles.bridge}
                        />
                      ))
                    : [],
                )}
              </svg>
              {dots.map((d, i) => (
                <span
                  key={i}
                  className={styles.dot}
                  data-hollow={d.hollow || undefined}
                  data-highlight={d.column === highlight || undefined}
                  style={
                    {
                      left: `${x(d.column)}%`,
                      top: `${y(d.value)}%`,
                      '--dot': d.color,
                    } as React.CSSProperties
                  }
                />
              ))}
              {dots.map(
                (d, i) =>
                  d.label && (
                    <span
                      key={`label-${i}`}
                      className={styles.dotLabel}
                      data-hollow={d.hollow || undefined}
                      style={{ left: `${x(d.column)}%`, top: `${y(d.value)}%` }}
                      aria-hidden="true"
                    >
                      {d.label}
                    </span>
                  ),
              )}
              {callout && top && (
                <span
                  className={styles.callout}
                  style={{ left: `${x(top.column)}%`, top: `${y(top.value)}%` }}
                >
                  {callout}
                </span>
              )}
            </div>

            {hasLabels && (
              <div
                className={styles.labels}
                style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
                aria-hidden="true"
              >
                {columns.map((c) => (
                  <span key={c.key} className={styles.label}>
                    {c.label && (
                      <>
                        <strong>{c.label[0]}</strong>
                        {c.label[1]}
                      </>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </figure>
  )
}

/** Maps a value to a % from the top. With ticks, the range snaps to round numbers. */
function scale(
  values: (number | null)[],
  opts: { invert: boolean; zeroLine: boolean; withTicks: boolean },
) {
  const known = values.filter((v): v is number => v !== null)
  let min = known.length ? Math.min(...known) : 0
  let max = known.length ? Math.max(...known) : 1
  let ticks: number[] = []

  if (opts.zeroLine) {
    const reach = Math.max(Math.abs(min), Math.abs(max), 5)
    min = -reach * 1.15
    max = reach * 1.15
  } else if (opts.withTicks) {
    // Never zoom in so far that a tiny difference looks like a big jump: show a
    // span of at least MIN_SPAN of the values, plus some room above and below.
    const middle = (min + max) / 2
    const span = Math.max(max - min, Math.abs(middle) * MIN_SPAN, 1)
    min = Math.min(min, middle - span / 2) - span * 0.1
    max = Math.max(max, middle + span / 2) + span * 0.1
    const step = niceStep((max - min) / (TICK_COUNT - 1))
    min = Math.floor(min / step) * step
    max = Math.ceil(max / step) * step
    if (min === max) max = min + step
    for (let t = min; t <= max + step / 2; t += step) ticks.push(Number(t.toFixed(6)))
  } else {
    const pad = (max - min || 2) * 0.15
    min -= pad
    max += pad
  }

  const y = (v: number) => {
    const f = (v - min) / (max - min)
    return (opts.invert ? f : 1 - f) * 100
  }
  return { y, ticks }
}

/** A round step (1, 2 or 5 × a power of ten) close to `rough`. */
function niceStep(rough: number): number {
  const power = 10 ** Math.floor(Math.log10(rough))
  const scaled = rough / power
  const nice = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10
  return nice * power
}

/** The point a line enters from, left of the first column (none, if it starts there). */
function entry(line: Line, y: (v: number) => number): string[] {
  if (line.from === 'origin') return ['0,100']
  if (typeof line.from === 'number') return [`0,${y(line.from)}`]
  return []
}

/** Runs of consecutive columns that have values (a line needs two points). */
function segments(values: (number | null)[]): number[][] {
  const runs: number[][] = []
  let run: number[] = []
  values.forEach((v, i) => {
    if (v === null) {
      if (run.length) runs.push(run)
      run = []
    } else run.push(i)
  })
  if (run.length) runs.push(run)
  // A line needs two points; a lone first point can still be joined to the origin.
  return runs.filter((r) => r.length > 1 || r[0] === 0)
}

/** Pairs of columns with values that have only empty columns between them. */
function gaps(values: (number | null)[]): [number, number][] {
  const filled = values.flatMap((v, i) => (v === null ? [] : [i]))
  return filled.slice(1).flatMap((to, k) => (to - filled[k] > 1 ? [[filled[k], to]] : []))
}
