import styles from './ColumnLineChart.module.css'

export interface Column {
  key: string
  label?: [string, string] // two lines under the column, e.g. ['16', 'Sept']
  ariaLabel: string
}

export interface Line {
  values: (number | null)[] // one per column; null leaves a gap
  variant: 'actual' | 'target' | 'trend'
}

export interface Dot {
  column: number
  value: number
  color: string
  hollow?: boolean // a planned (future) point
}

interface Props {
  columns: Column[]
  lines: Line[]
  dots: Dot[]
  height?: number
  invert?: boolean // lower is better: the scale flips so "up" always means progress
  zeroLine?: boolean // for changes: a baseline at 0, and a range balanced around it
  selected?: number
  onSelect?: (index: number) => void
  callout?: string // a short label above the selected column's top dot
  label: string
}

/**
 * Equal-width columns with lines through them. Lines are drawn in a stretched SVG
 * (strokes keep their width); dots, labels and tap targets are HTML laid over it, so
 * they stay round and crisp at any size. Columns are buttons when `onSelect` is given.
 */
export function ColumnLineChart({
  columns,
  lines,
  dots,
  height = 160,
  invert = false,
  zeroLine = false,
  selected,
  onSelect,
  callout,
  label,
}: Props) {
  const n = columns.length
  const x = (i: number) => ((i + 0.5) / n) * 100
  const y = scale(
    [...lines.flatMap((l) => l.values), ...dots.map((d) => d.value)],
    invert,
    zeroLine,
  )
  const top = dots
    .filter((d) => d.column === selected)
    .reduce<Dot | null>((best, d) => (!best || y(d.value) < y(best.value) ? d : best), null)

  return (
    <div className={styles.chart} data-interactive={onSelect ? true : undefined}>
      {onSelect ? (
        <div
          className={styles.columns}
          style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
          role="radiogroup"
          aria-label={label}
        >
          {columns.map((c, i) => (
            <button
              key={c.key}
              type="button"
              role="radio"
              aria-checked={i === selected}
              aria-label={c.ariaLabel}
              className={styles.column}
              data-selected={i === selected || undefined}
              onClick={() => onSelect(i)}
              onKeyDown={(e) => {
                const next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : null
                if (next === null || next < 0 || next >= n) return
                e.preventDefault()
                onSelect(next)
                ;(e.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus()
              }}
              tabIndex={i === selected ? 0 : -1}
            >
              {c.label && (
                <span className={styles.label}>
                  <strong>{c.label[0]}</strong>
                  {c.label[1]}
                </span>
              )}
            </button>
          ))}
        </div>
      ) : (
        <span className="visually-hidden">{label}</span>
      )}
      <div className={styles.plot} style={{ height }}>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className={styles.svg}
          aria-hidden="true"
        >
          {zeroLine && <line x1="0" x2="100" y1={y(0)} y2={y(0)} className={styles.zero} />}
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
            data-selected={d.column === selected || undefined}
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
    </div>
  )
}

/** Maps a value to a % from the top, with headroom; flipped when lower is better. */
function scale(values: (number | null)[], invert: boolean, zeroLine: boolean) {
  const known = values.filter((v): v is number => v !== null)
  let min = Math.min(...known, zeroLine ? 0 : Infinity)
  let max = Math.max(...known, zeroLine ? 0 : -Infinity)
  if (zeroLine) {
    const reach = Math.max(Math.abs(min), Math.abs(max), 5)
    min = -reach
    max = reach
  }
  if (!Number.isFinite(min) || min === max) {
    min = (Number.isFinite(min) ? min : 0) - 1
    max = min + 2
  }
  const pad = (max - min) * 0.15
  min -= pad
  max += pad
  return (v: number) => {
    const f = (v - min) / (max - min)
    return (invert ? f : 1 - f) * 100
  }
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
