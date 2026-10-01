import { useState } from 'react'
import { useParams } from 'react-router'
import { useExercise } from '../api/client'
import type { Exercise, Mode, RangeProgress, Session, Target } from '../api/types'
import { Card } from '../components/Card'
import { ErrorMessage, Loading } from '../components/Feedback'
import { TrendMark } from '../components/TrendMark'
import { ColumnLineChart } from '../charts/ColumnLineChart'
import { SessionDeck } from '../exercise/SessionDeck'
import { kg, pct, shortDate } from '../format'
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
        <div>
          <h1 className={styles.title}>{exercise.title}</h1>
          {range.trend !== 'new' && range.change_pct !== null && (
            <p className={styles.change}>
              <TrendMark trend={range.trend} /> <strong>{pct(range.change_pct)}</strong>
            </p>
          )}
        </div>
        {exercise.ranges.length > 1 && (
          <div className={styles.toggle} role="tablist" aria-label="Rep range">
            {[...exercise.ranges].sort(byRange).map((r) => (
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

// The cards and the graph show this much history (about one training block).
const HISTORY_DAYS = 84

function RangeView({ exercise, range }: { exercise: Exercise; range: RangeProgress }) {
  const mode = exercise.mode
  const sessions = recentSessions(range.sessions)

  return (
    <>
      <ProgressCard exercise={exercise} range={range} sessions={sessions} />
      <SessionDeck sessions={sessions} plan={range.plan} mode={mode} />

      {range.capacity && (
        <Card title="Tip!">
          <p className={styles.tip}>
            Try <strong>{kg(range.capacity.weight_kg)} kg</strong>. Your other{' '}
            {muscleName(exercise.primary_muscle)} exercises are up {kg(range.capacity.change_pct)}%
            ({range.capacity.evidence.map((e) => e.title).join(', ')}).
          </p>
        </Card>
      )}
    </>
  )
}

/** Sessions from the last HISTORY_DAYS before the latest one (always at least the latest). */
function recentSessions(sessions: Session[]): Session[] {
  const latest = Date.parse(sessions[sessions.length - 1].date)
  const from = latest - HISTORY_DAYS * 24 * 60 * 60 * 1000
  return sessions.filter((s) => Date.parse(s.date) >= from)
}

/**
 * What you actually lifted each session (solid) against what the plan asked for
 * (dashed), continuing into this session and the next. For a first session the plan
 * is simply what you did, so the plan line runs unbroken from the start.
 */
function ProgressCard({
  exercise,
  range,
  sessions,
}: {
  exercise: Exercise
  range: RangeProgress
  sessions: Session[]
}) {
  const mode = exercise.mode
  const past = sessions
  const planned = [
    { name: 'This', value: targetValue(range.plan.today, mode) },
    { name: 'Next', value: targetValue(range.plan.then, mode) },
  ]

  const columns = [
    ...past.map((s, i) => {
      const [day, month] = shortDate(s.date).split(' ')
      return { key: `${s.date}-${i}`, label: [day, month] as [string, string] }
    }),
    ...planned.map((p) => ({ key: p.name, label: [p.name, 'session'] as [string, string] })),
  ]
  const actual = [...past.map((s) => liftedValue(s, mode)), ...planned.map(() => null)]
  const plan = [
    ...past.map((s) => (s.target ? targetValue(s.target, mode) : liftedValue(s, mode))),
    ...planned.map((p) => p.value),
  ]

  const dots = past.map((s, i) => ({
    column: i,
    value: actual[i]!,
    color: s.trend === 'new' ? 'var(--chart-actual)' : TREND_INFO[s.trend].color,
  }))

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
        label={`${axisName(mode)} by session`}
        columns={columns}
        lines={[
          { values: plan, variant: 'target', fromOrigin: true },
          { values: actual, variant: 'actual' },
        ]}
        dots={dots}
        invert={exercise.lower_is_better}
        yAxis={{ format: (v) => `${kg(v)}${axisUnit(mode)}` }}
        height={180}
      />
    </Card>
  )
}

/** What the chart plots for a session: the heaviest weight (or reps, or seconds). */
function liftedValue(session: Session, mode: Mode): number {
  if (mode === 'reps') return Math.max(...session.did.reps)
  if (mode === 'duration') return session.did.duration_seconds ?? 0
  return session.did.weight_kg ?? 0
}

/** The same measure for a plan's target. */
function targetValue(target: Target, mode: Mode): number {
  if (mode === 'reps') return target.reps ?? 0
  if (mode === 'duration') return target.duration_seconds ?? 0
  return target.weight_kg ?? 0
}

/** Hypertrophy always first, then Endurance, whichever was trained first. */
function byRange(a: RangeProgress, b: RangeProgress): number {
  const order = ['strength', 'light']
  return order.indexOf(a.rep_range ?? '') - order.indexOf(b.rep_range ?? '')
}

/** What the chart's y-axis measures, per exercise type. */
function axisName(mode: Mode): string {
  const names: Partial<Record<Mode, string>> = {
    load: 'Heaviest weight lifted (kg)',
    assisted: 'Assistance (kg), less is better',
    reps: 'Best set (reps)',
    duration: 'Longest hold (seconds)',
  }
  return names[mode] ?? ''
}

function axisUnit(mode: Mode): string {
  return mode === 'duration' ? 's' : mode === 'reps' ? '' : ' kg'
}

// "glute exercises", not "glutes exercises".
const SINGULAR: Record<string, string> = {
  abdominals: 'abdominal',
  abductors: 'abductor',
  adductors: 'adductor',
  calves: 'calf',
  forearms: 'forearm',
  glutes: 'glute',
  hamstrings: 'hamstring',
  lats: 'lat',
  shoulders: 'shoulder',
  traps: 'trap',
}

function muscleName(group: string): string {
  return SINGULAR[group] ?? group.replaceAll('_', ' ')
}
