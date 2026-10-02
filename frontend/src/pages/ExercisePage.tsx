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
        {exercise.ranges.length > 1 ? (
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
        ) : (
          // Only one range trained: show which, in the toggle's place and style, but not
          // as a control (a disabled option would look broken).
          range.rep_range && (
            <span className={styles.toggle}>
              <span
                className={styles.toggleOption}
                data-selected
                title={RANGE_REPS[range.rep_range]}
              >
                {RANGE_NAMES[range.rep_range]}
              </span>
            </span>
          )
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
 * (dashed), continuing through the climb to the next weight. For a first session the
 * plan is simply what you did, so the plan line runs unbroken from the start.
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
  const ahead = range.plan.climb
  // Older sessions than the chart shows: the plan line comes in at the level it was at
  // then. Otherwise it starts from the corner, as the plan starts from nothing.
  const before = range.sessions[range.sessions.length - past.length - 1]

  const columns = [
    ...past.map((s, i) => {
      const [day, month] = shortDate(s.date).split(' ')
      return { key: `${s.date}-${i}`, label: [day, month] as [string, string] }
    }),
    ...ahead.map((_, i) => ({
      key: `plan-${i}`,
      label: [AHEAD_NAMES[i] ?? `${i + 1}th`, 'session'] as [string, string],
    })),
  ]
  const actual = [...past.map((s) => liftedValue(s, mode)), ...ahead.map(() => null)]
  const planned = (s: Session) => (s.target ? targetValue(s.target, mode) : liftedValue(s, mode))
  const plan = [...past.map(planned), ...ahead.map((t) => targetValue(t, mode))]

  const planFrom = before ? planned(before) : ('origin' as const)

  const dots = [
    ...past.map((s, i) => ({
      column: i,
      value: actual[i]!,
      color: s.trend === 'new' ? 'var(--chart-actual)' : TREND_INFO[s.trend].color,
      label: pointLabel(s.did.weight_kg, Math.min(...s.did.reps), mode),
    })),
    ...ahead.map((t, i) => ({
      column: past.length + i,
      value: plan[past.length + i]!,
      color: 'var(--chart-target)',
      hollow: true,
      label: pointLabel(t.weight_kg, t.reps, mode),
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
        label={`${axisName(mode)} by session`}
        columns={columns}
        lines={[
          { values: plan, variant: 'target', from: planFrom },
          { values: actual, variant: 'actual' },
        ]}
        dots={dots}
        invert={exercise.lower_is_better}
        yAxis={{
          format: (v) => `${mode === 'load' ? Math.round(v) : kg(v)}${axisUnit(mode)}`,
          ...(mode === 'load' && { title: 'Strength score', hint: SCORE_EXPLAINED }),
        }}
        height={180}
        minColumnWidth={COLUMN_WIDTH}
        startAt={past.length}
      />
    </Card>
  )
}

// Wide enough for a label like '31.5×12' over each point.
const COLUMN_WIDTH = 48
// The plan's columns, from this session on.
const AHEAD_NAMES = ['This', 'Next', '3rd']

const SCORE_EXPLAINED =
  'Weight and reps combined (Epley: weight × (1 + reps ÷ 30)), so one more rep at the same weight still counts as progress.'

/**
 * What the chart plots for a session. Lifts: the strength score, so more reps at the
 * same weight still climbs. Otherwise the best reps, the longest hold, or the assistance.
 */
function liftedValue(session: Session, mode: Mode): number {
  if (mode === 'load') return session.did_score
  if (mode === 'reps') return Math.max(...session.did.reps)
  if (mode === 'duration') return session.did.duration_seconds ?? 0
  return session.did.weight_kg ?? 0
}

/** The same measure for a plan's target. */
function targetValue(target: Target, mode: Mode): number {
  if (mode === 'load') return target.score
  if (mode === 'reps') return target.reps ?? 0
  if (mode === 'duration') return target.duration_seconds ?? 0
  return target.weight_kg ?? 0
}

/** What was (or will be) lifted, over a point: '29×8'. Only where weight and reps both count. */
function pointLabel(weight: number | null, reps: number | null, mode: Mode): string | undefined {
  if ((mode !== 'load' && mode !== 'assisted') || weight === null || reps === null) return undefined
  return `${kg(weight)}×${reps}`
}

/** Hypertrophy always first, then Endurance, whichever was trained first. */
function byRange(a: RangeProgress, b: RangeProgress): number {
  const order = ['strength', 'light']
  return order.indexOf(a.rep_range ?? '') - order.indexOf(b.rep_range ?? '')
}

/** What the chart's y-axis measures, per exercise type. */
function axisName(mode: Mode): string {
  const names: Partial<Record<Mode, string>> = {
    load: 'Strength score (weight and reps combined)',
    assisted: 'Assistance (kg), less is better',
    reps: 'Best set (reps)',
    duration: 'Longest hold (seconds)',
  }
  return names[mode] ?? ''
}

function axisUnit(mode: Mode): string {
  if (mode === 'duration') return 's'
  return mode === 'assisted' ? ' kg' : '' // a strength score has no unit
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
