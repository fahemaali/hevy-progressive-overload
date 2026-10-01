import { useState } from 'react'
import { useParams } from 'react-router'
import { useExercise } from '../api/client'
import type { Exercise, Mode, RangeProgress, Session, Target } from '../api/types'
import { Card } from '../components/Card'
import { ErrorMessage, Loading } from '../components/Feedback'
import { TrendMark } from '../components/TrendMark'
import { ColumnLineChart } from '../charts/ColumnLineChart'
import { planNote } from '../exercise/planNote'
import { formatSet, formatTarget, kg, pct, plural, shortDate } from '../format'
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

  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.title}>{exercise.title}</h1>
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

      {/* Keyed by range so the chart's selection resets when switching. */}
      <RangeView key={range.rep_range ?? 'all'} exercise={exercise} range={range} />
    </>
  )
}

function RangeView({ exercise, range }: { exercise: Exercise; range: RangeProgress }) {
  const mode = exercise.mode

  return (
    <>
      <Headline exercise={exercise} range={range} />
      <ProgressCard exercise={exercise} range={range} />

      <Card title="Next session">
        {range.plan.ahead_of_plan && <p className={styles.ahead}>Ahead of plan</p>}
        <div className={styles.targets}>
          <div>
            <span className={styles.targetLabel}>Today</span>
            <span className={styles.today}>{formatTarget(range.plan.today, mode)}</span>
            {range.plan.today.sets > 1 && (
              <span className={styles.sets}>{plural(range.plan.today.sets, 'set')}</span>
            )}
          </div>
          <div>
            <span className={styles.targetLabel}>Then</span>
            <span className={styles.then}>{formatTarget(range.plan.then, mode)}</span>
          </div>
        </div>
        <p className={styles.note}>{planNote(range.plan, mode)}</p>
      </Card>

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

/** The headline number, its trend, and where it stands against your best. */
function Headline({ exercise, range }: { exercise: Exercise; range: RangeProgress }) {
  const latest = range.sessions[range.sessions.length - 1]
  const best = bestSession(range.sessions, exercise.lower_is_better)
  const isWeighted = range.est_1rm_kg !== null
  const show = (s: Session) => (isWeighted ? `${kg(s.score)} kg` : formatSet(s.did, exercise.mode))

  let bestLine: string
  if (range.sessions.length === 1) bestLine = 'First session: your starting point'
  else if (range.is_best) bestLine = 'New personal best'
  else if (best.score === latest.score) bestLine = 'Matches your personal best'
  else bestLine = `Personal best: ${show(best)} on ${shortDate(best.date)}`

  return (
    <Card label="Summary">
      <div className={styles.headline}>
        <div>
          <span className={styles.headlineLabel}>
            {isWeighted ? 'Estimated 1-rep max' : headlineLabel(exercise.mode)}
          </span>
          <span className={styles.headlineValue}>{show(latest)}</span>
          <span className={styles.bestLine}>{bestLine}</span>
        </div>
        {range.trend !== 'new' && range.change_pct !== null && (
          <span className={styles.chip}>
            <TrendMark trend={range.trend} />
            {pct(range.change_pct)} <span className={styles.chipNote}>vs recent sessions</span>
          </span>
        )}
      </div>
    </Card>
  )
}

/**
 * You (solid) against the plan (dashed), one column per session, with the plan
 * continuing into the next two sessions, so even a new exercise has a few columns.
 */
function ProgressCard({ exercise, range }: { exercise: Exercise; range: RangeProgress }) {
  const past = range.sessions
  const future: { name: 'Next' | 'Then'; target: Target; score: number }[] = [
    { name: 'Next', target: range.plan.today, score: range.plan.today_score },
    { name: 'Then', target: range.plan.then, score: range.plan.then_score },
  ]
  const [selected, setSelected] = useState(past.length - 1)

  const columns = [
    ...past.map((s, i) => {
      const [day, month] = shortDate(s.date).split(' ')
      return {
        key: `${s.date}-${i}`,
        label: [day, month] as [string, string],
        ariaLabel: shortDate(s.date),
      }
    }),
    ...future.map((f) => ({
      key: f.name,
      label: [f.name, 'session'] as [string, string],
      ariaLabel: `${f.name} session`,
    })),
  ]
  const actual = [...past.map((s) => s.score), ...future.map(() => null)]
  const target = [...past.map((s) => s.target_score), ...future.map((f) => f.score)]
  // Start the plan line from your last session, so it visibly carries on from it.
  if (target[past.length - 1] === null) target[past.length - 1] = past[past.length - 1].score

  const dots = [
    // The plan's target for each past session: hollow, like the planned ones ahead.
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
  const upcoming = selected >= past.length ? future[selected - past.length] : null

  return (
    <Card title="Progress">
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
        label="Sessions"
        columns={columns}
        lines={[
          { values: target, variant: 'target' },
          { values: actual, variant: 'actual' },
        ]}
        dots={dots}
        invert={exercise.lower_is_better}
        height={170}
        selected={selected}
        onSelect={setSelected}
      />
      <p className={styles.readout} aria-live="polite">
        {upcoming ? (
          <FutureReadout name={upcoming.name} target={upcoming.target} mode={exercise.mode} />
        ) : (
          <PastReadout session={past[selected]} mode={exercise.mode} />
        )}
      </p>
    </Card>
  )
}

function PastReadout({ session, mode }: { session: Session; mode: Mode }) {
  return (
    <>
      <strong>{shortDate(session.date)}</strong> · You lifted{' '}
      <strong>{formatSet(session.did, mode)}</strong>
      <br />
      {session.target === null ? (
        'First session: your starting point'
      ) : (
        <>
          Target was {formatTarget(session.target, mode)} · <VsTarget value={session.vs_target} />
        </>
      )}
    </>
  )
}

function FutureReadout({
  name,
  target,
  mode,
}: {
  name: 'Next' | 'Then'
  target: Target
  mode: Mode
}) {
  return (
    <>
      <strong>{name === 'Next' ? 'Next session' : 'The one after'}</strong> · Aim for{' '}
      <strong>{formatTarget(target, mode)}</strong>
      <br />
      {name === 'Next' ? 'Planned from your last session' : 'If you hit the next one'}
    </>
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

function bestSession(sessions: Session[], lowerIsBetter: boolean): Session {
  return sessions.reduce((best, s) =>
    (lowerIsBetter ? s.score < best.score : s.score > best.score) ? s : best,
  )
}

function headlineLabel(mode: Mode): string {
  const labels: Partial<Record<Mode, string>> = {
    assisted: 'Assistance',
    reps: 'Latest best set',
    duration: 'Longest hold',
  }
  return labels[mode] ?? ''
}

function label(group: string): string {
  const text = group.replaceAll('_', ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}
