import styles from './ColumnLineChart.module.css'

export interface Column {
  key: string
  label?: [string, string] // two lines under the column, e.g. ['16', 'Sept']
}

export interface Line {
  values: (number | null)[] // one per column; null leaves a gap
  variant: 'actual' | 'target' | 'trend'
}

export interface Dot {
  column: number
  value: number
  color: string
  hollow?: boolean // a planned point
}

interface Props {
  columns: Column[]
  lines: Line[]
  dots: Dot[]
  label: string // what the chart shows, for screen readers
  height?: number
  invert?: boolean // lower is better: the scale flips so "up" always means progress
  zeroLine?: boolean // for changes: a baseline at 0, and a range balanced around it
  yAxis?: { format: (value: number) => string } // value labels and gridlines on the left
  highlight?: number // a column whose dot is drawn larger
  callout?: string // a short label above the highlighted column's top dot
}

const TICK_COUNT = 4

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
}: Props) {
  const n = columns.length
  const x = (i: number) => ((i + 0.5) / n) * 100
  const values = [...lines.flatMap((l) => l.values), ...dots.map((d) => d.value)]
  const { y, ticks } = scale(values, { invert, zeroLine, withTicks: Boolean(yAxis) })
  const top = dots
    .filter((d) => d.column === highlight)
    .reduce<Dot | null>((best, d) => (!best || y(d.value) < y(best.value) ? d : best), null)
  const hasLabels = columns.some((c) => c.label)

  return (
    <figure className={styles.chart} data-y-axis={yAxis ? true : undefined} aria-label={label}>
      {yAxis && (
        <div className={styles.yAxis} style={{ height }} aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} className={styles.tick} style={{ top: `${y(t)}%` }}>
              {yAxis.format(t)}
            </span>
          ))}
        </div>
      )}

      <div className={styles.body}>
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
                  points={seg.map((i) => `${x(i)},${y(line.values[i]!)}`).join(' ')}
                  className={styles[line.variant]}
                />
              )),
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
    const step = niceStep((max - min || Math.abs(max) || 1) / (TICK_COUNT - 1))
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
  return runs.filter((r) => r.length > 1)
}
