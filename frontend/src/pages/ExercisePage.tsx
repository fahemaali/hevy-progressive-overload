import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useExercise } from '../api/client'
import type { Exercise, Mode, RangeProgress, RepRange, Session } from '../api/types'
import { BackLink } from '../components/BackLink'
import { Card } from '../components/Card'
import { ErrorMessage, Loading } from '../components/Feedback'
import { TrendMark } from '../components/TrendMark'
import { ProgressChart } from '../exercise/ProgressChart'
import { planNote } from '../exercise/planNote'
import { formatSet, formatTarget, kg, pct, plural, shortDate } from '../format'
import styles from './ExercisePage.module.css'

const RANGE_LABELS: Record<RepRange, string> = { strength: 'Strength', light: 'Light' }

export function ExercisePage() {
  const { id = '' } = useParams()
  const { data, error, isPending } = useExercise(id)

  return (
    <>
      <BackLink fallback={data ? `/muscles/${data.primary_muscle}` : '/'} label="Back" />
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
        <Link to={`/muscles/${exercise.primary_muscle}`} className={styles.muscle}>
          {label(exercise.primary_muscle)}
        </Link>
      </header>

      {exercise.ranges.length > 1 && (
        <div className={styles.toggle} role="tablist" aria-label="Rep range">
          {exercise.ranges.map((r) => (
            <button
              key={r.rep_range}
              type="button"
              role="tab"
              aria-selected={r === range}
              className={styles.toggleOption}
              onClick={() => setRangeKey(r.rep_range)}
            >
              {r.rep_range ? RANGE_LABELS[r.rep_range] : 'All'}
            </button>
          ))}
        </div>
      )}

      {/* Keyed by range so the chart's selection resets when switching. */}
      <RangeView key={range.rep_range ?? 'all'} exercise={exercise} range={range} />
    </>
  )
}

function RangeView({ exercise, range }: { exercise: Exercise; range: RangeProgress }) {
  const [selected, setSelected] = useState(range.sessions.length - 1)
  const mode = exercise.mode

  return (
    <>
      <Headline exercise={exercise} range={range} />

      <Card title="Progress">
        <ProgressChart
          sessions={range.sessions}
          lowerIsBetter={exercise.lower_is_better}
          selected={selected}
          onSelect={setSelected}
        />
        <SessionReadout session={range.sessions[selected]} mode={mode} />
      </Card>

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

/** The headline number: est. 1RM for weighted exercises, otherwise the latest best. */
function Headline({ exercise, range }: { exercise: Exercise; range: RangeProgress }) {
  const latest = range.sessions[range.sessions.length - 1]
  const first = range.trend === 'new'
  return (
    <Card label="Summary">
      <div className={styles.headline}>
        <div>
          <span className={styles.headlineLabel}>
            {range.est_1rm_kg !== null ? 'Est. 1RM' : headlineLabel(exercise.mode)}
          </span>
          <span className={styles.headlineValue}>
            {range.est_1rm_kg !== null
              ? `${kg(range.est_1rm_kg)} kg`
              : formatSet(latest.did, exercise.mode)}
          </span>
        </div>
        <div className={styles.chips}>
          {first ? (
            <span className={styles.chip}>First session</span>
          ) : (
            <span className={styles.chip}>
              <TrendMark trend={range.trend} />
              {range.change_pct !== null ? pct(range.change_pct) : ''}
            </span>
          )}
          {range.is_best && <span className={`${styles.chip} ${styles.best}`}>Best</span>}
          {!range.is_best && range.off_best_pct !== null && range.off_best_pct > 0 && (
            <span className={styles.chip}>{pct(-range.off_best_pct)} from best</span>
          )}
        </div>
      </div>
    </Card>
  )
}

function SessionReadout({ session, mode }: { session: Session; mode: Mode }) {
  return (
    <dl className={styles.readout} aria-live="polite">
      <div>
        <dt>{shortDate(session.date)}</dt>
        <dd>
          <TrendMark trend={session.trend} showLabel />
        </dd>
      </div>
      <div>
        <dt>Did</dt>
        <dd>{formatSet(session.did, mode)}</dd>
      </div>
      <div>
        <dt>Target</dt>
        <dd>
          {session.target ? (
            <>
              {formatTarget(session.target, mode)} <VsTarget value={session.vs_target} />
            </>
          ) : (
            'First session'
          )}
        </dd>
      </div>
    </dl>
  )
}

function VsTarget({ value }: { value: Session['vs_target'] }) {
  if (value === null) return null
  const text = value === 1 ? 'Beat it' : value === 0 ? 'Hit it' : 'Missed'
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
            <th scope="col">Did</th>
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
                <TrendMark trend={s.trend} showLabel />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}

function headlineLabel(mode: Mode): string {
  return (
    { assisted: 'Assistance', reps: 'Best set', duration: 'Longest hold' }[mode as string] ?? ''
  )
}

function label(group: string): string {
  const text = group.replaceAll('_', ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}
