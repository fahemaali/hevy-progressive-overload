import { useState } from 'react'
import { useParams } from 'react-router'
import { useExercise } from '../api/client'
import type { Exercise, Mode, RangeProgress, Session } from '../api/types'
import { Card } from '../components/Card'
import { ErrorMessage, Loading } from '../components/Feedback'
import { TrendMark } from '../components/TrendMark'
import { ColumnLineChart } from '../charts/ColumnLineChart'
import { SessionDeck } from '../exercise/SessionDeck'
import { formatSet, formatTarget, kg, pct, shortDate } from '../format'
import { RANGE_NAMES, RANGE_REPS } from '../ranges'
import { TREND_INFO } from '../trends'
import styles from './ExercisePage.module.css'

export function ExercisePage() {
  const { id = '' } = useParams()
  const { data, error, isPending } = useExercise(id)

  return (
    <>
      {isPending && <Loading label="Loading exercise" />}
      {error && <ErrorMessage error={error} />}
      {data && <ExerciseView key={data.id} exercise={data} />}
    </>
  )
}

function ExerciseView({ exercise }: { exercise: Exercise }) {
  const [rangeKey, setRangeKey] = useState(exercise.default_range)
  const range = exercise.ranges.find((r) => r.rep_range === rangeKey) ?? exercise.ranges[0]
  const latest = range.sessions[range.sessions.length - 1]

  return (
    <>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{exercise.title}</h1>
          {range.trend !== 'new' && range.change_pct !== null && (
            <p className={styles.change}>
              <TrendMark trend={range.trend} /> <strong>{pct(range.change_pct)}</strong> · last
              session, {shortDate(latest.date)}
            </p>
          )}
        </div>
        {exercise.ranges.length > 1 && (
          <div className={styles.toggle} role="tablist" aria-label="Rep range">
            {exercise.ranges.map((r) => (
              <button
                key={r.rep_range}
                type="button"
                role="tab"
                aria-selected={r === range}
                title={r.rep_range ? RANGE_REPS[r.rep_range] : undefined}
                className={styles.toggleOption}
                onClick={() => setRangeKey(r.rep_range)}
              >
                {r.rep_range ? RANGE_NAMES[r.rep_range] : 'All'}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Keyed by range so the deck re-centres when switching. */}
      <RangeView key={range.rep_range ?? 'all'} exercise={exercise} range={range} />
    </>
  )
}

function RangeView({ exercise, range }: { exercise: Exercise; range: RangeProgress }) {
  const mode = exercise.mode
  const last = range.sessions[range.sessions.length - 1]

  return (
    <>
      <ProgressCard exercise={exercise} range={range} />
      <SessionDeck last={last} plan={range.plan} mode={mode} />

      {range.capacity && (
        <Card title="Capacity">
          <p className={styles.capacity}>
            Try <strong>{kg(range.capacity.weight_kg)} kg</strong>
          </p>
          <p className={styles.capacityWhy}>
            Your other {label(exercise.primary_muscle).toLowerCase()} exercises are up{' '}
            {pct(range.capacity.change_pct)} since you last did this:{' '}
            {range.capacity.evidence.map((e) => `${e.title} ${pct(e.change_pct)}`).join(', ')}.
          </p>
        </Card>
      )}

      <SessionTable sessions={range.sessions} mode={mode} />
    </>
  )
}

/**
 * A graph of you (solid) against the plan (dashed), one column per session, with the
 * plan continuing into this session and the next, so even a new exercise has a few
 * columns. The est. 1RM sits in a small card in the corner.
 */
function ProgressCard({ exercise, range }: { exercise: Exercise; range: RangeProgress }) {
  const past = range.sessions
  const future = [
    { name: 'This', score: range.plan.today_score },
    { name: 'Next', score: range.plan.then_score },
  ]
  const latest = past[past.length - 1]

  const columns = [
    ...past.map((s, i) => {
      const [day, month] = shortDate(s.date).split(' ')
      return { key: `${s.date}-${i}`, label: [day, month] as [string, string] }
    }),
    ...future.map((f) => ({ key: f.name, label: [f.name, 'session'] as [string, string] })),
  ]
  const actual = [...past.map((s) => s.score), ...future.map(() => null)]
  const target = [...past.map((s) => s.target_score), ...future.map((f) => f.score)]
  // Start the plan line from your last session, so it visibly carries on from it.
  if (target[past.length - 1] === null) target[past.length - 1] = latest.score

  const dots = [
    // The plan's target for each session: hollow, like the planned ones ahead.
    ...past.flatMap((s, i) =>
      s.target_score === null
        ? []
        : [{ column: i, value: s.target_score, color: 'var(--chart-target)', hollow: true }],
    ),
    ...past.map((s, i) => ({
      column: i,
      value: s.score,
      color: s.trend === 'new' ? 'var(--chart-actual)' : TREND_INFO[s.trend].color,
    })),
    ...future.map((f, i) => ({
      column: past.length + i,
      value: f.score,
      color: 'var(--chart-target)',
      hollow: true,
    })),
  ]

  return (
    <Card
      title="Progress"
      action={
        range.est_1rm_kg !== null && (
          <span className={styles.oneRm}>
            <small>Est. 1RM</small>
            {kg(range.est_1rm_kg)} kg
          </span>
        )
      }
    >
      <ul className={styles.legend} aria-label="Chart legend">
        <li>
          <span className={styles.keyActual} aria-hidden="true" />
          You
        </li>
        <li>
          <span className={styles.keyTarget} aria-hidden="true" />
          Plan
        </li>
      </ul>
      <ColumnLineChart
        label={`${axisName(exercise.mode)} by session`}
        columns={columns}
        lines={[
          { values: target, variant: 'target' },
          { values: actual, variant: 'actual' },
        ]}
        dots={dots}
        invert={exercise.lower_is_better}
        yAxis={{
          title: axisName(exercise.mode),
          format: (v) => `${kg(v)}${axisUnit(exercise.mode)}`,
        }}
        height={180}
      />
    </Card>
  )
}

function VsTarget({ value }: { value: Session['vs_target'] }) {
  if (value === null) return null
  const text = value === 1 ? 'beaten' : value === 0 ? 'hit' : 'missed'
  return (
    <span className={styles.vs} data-missed={value === -1 || undefined}>
      {value >= 0 ? '✓' : '✗'} {text}
    </span>
  )
}

/** Every session as a table: the chart's readable-without-a-chart twin. */
function SessionTable({ sessions, mode }: { sessions: Session[]; mode: Mode }) {
  return (
    <details className={styles.details}>
      <summary>All sessions ({sessions.length})</summary>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">You lifted</th>
            <th scope="col">Target</th>
            <th scope="col">Result</th>
          </tr>
        </thead>
        <tbody>
          {[...sessions].reverse().map((s, i) => (
            <tr key={`${s.date}-${i}`}>
              <td>{shortDate(s.date)}</td>
              <td>{formatSet(s.did, mode)}</td>
              <td>
                {s.target ? formatTarget(s.target, mode) : '–'} <VsTarget value={s.vs_target} />
              </td>
              <td>
                {s.trend === 'new' ? 'First session' : <TrendMark trend={s.trend} showLabel />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}

/** What the chart's y-axis measures, per exercise type. */
function axisName(mode: Mode): string {
  const names: Partial<Record<Mode, string>> = {
    load: 'Estimated 1-rep max (kg)',
    assisted: 'Assistance (kg), less is better',
    reps: 'Best set (reps)',
    duration: 'Longest hold (seconds)',
  }
  return names[mode] ?? ''
}

function axisUnit(mode: Mode): string {
  return mode === 'duration' ? 's' : mode === 'reps' ? '' : ' kg'
}

function label(group: string): string {
  const text = group.replaceAll('_', ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}
