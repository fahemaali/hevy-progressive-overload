import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useMuscle } from '../api/client'
import type { Muscle, MuscleWeek, StrengthEntry, Trend } from '../api/types'
import { STATE_STYLES, STATUS_STATES } from '../bodymap/states'
import { Card } from '../components/Card'
import { ErrorMessage, Loading } from '../components/Feedback'
import { TrendMark } from '../components/TrendMark'
import { formatBestSet, kg, shortDate } from '../format'
import { TREND_INFO } from '../trends'
import styles from './MusclePage.module.css'

export function MusclePage() {
  const { group = '' } = useParams()
  const { data, error, isPending } = useMuscle(group)

  return (
    <>
      {isPending && <Loading label="Loading muscle" />}
      {error && <ErrorMessage error={error} />}
      {data && <MuscleView key={data.group} muscle={data} />}
    </>
  )
}

function MuscleView({ muscle }: { muscle: Muscle }) {
  const direct = muscle.exercises.filter((e) => e.role === 'primary')
  const indirect = muscle.exercises.filter((e) => e.role === 'secondary')
  const style = STATE_STYLES[muscle.state]
  const hasStatus = STATUS_STATES.includes(muscle.state)
  const name = muscle.label.toLowerCase()

  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.title}>
          {hasStatus && (
            <span className={styles.symbol} style={{ color: style.color }} aria-hidden="true">
              {style.symbol}
            </span>
          )}
          {muscle.label}
          <span className="visually-hidden">: {style.label}</span>
        </h1>
        {!hasStatus && <p className={styles.subtitle}>{style.label}</p>}
        {muscle.stale && <p className={styles.subtitle}>Not trained in 3+ weeks</p>}
      </header>

      {muscle.weeks.length > 0 && <WeekByWeek weeks={muscle.weeks} />}

      {muscle.exercises.length === 0 ? (
        <Card>
          <p className={styles.empty}>No exercises for this muscle yet.</p>
        </Card>
      ) : (
        <>
          {direct.length > 0 && (
            <ExerciseList title={`${exerciseAdjective(muscle)} exercises`} entries={direct} />
          )}
          {indirect.length > 0 && <ExerciseList title={`Also works ${name}`} entries={indirect} />}
        </>
      )}
    </>
  )
}

const JUDGED: Trend[] = ['up', 'flat', 'down']

/** A strip of recent weeks, coloured by status; pick one to see its sessions. */
function WeekByWeek({ weeks }: { weeks: MuscleWeek[] }) {
  const lastJudged = weeks.findLastIndex((w) => JUDGED.includes(w.trend))
  const [selected, setSelected] = useState(lastJudged >= 0 ? lastJudged : weeks.length - 1)
  const week = weeks[selected]

  return (
    <Card title="Week by week">
      <div className={styles.strip} role="radiogroup" aria-label="Week">
        {weeks.map((w, i) => {
          const info = TREND_INFO[w.trend]
          const judged = JUDGED.includes(w.trend)
          const [day, month] = shortDate(w.week_start).split(' ')
          return (
            <button
              key={w.week_start}
              type="button"
              role="radio"
              aria-checked={i === selected}
              aria-label={`Week of ${shortDate(w.week_start)}: ${info.label}`}
              className={styles.week}
              data-selected={i === selected || undefined}
              onClick={() => setSelected(i)}
            >
              <span
                className={styles.square}
                style={judged ? { background: info.color, color: '#fff' } : undefined}
                aria-hidden="true"
              >
                {judged ? info.symbol : '–'}
              </span>
              <span className={styles.weekDate} aria-hidden="true">
                <strong>{day}</strong> {month}
              </span>
            </button>
          )
        })}
      </div>

      <div className={styles.weekDetail} aria-live="polite">
        <h3 className={styles.weekTitle}>
          Week of {shortDate(week.week_start)} · <TrendMark trend={week.trend} showLabel />
        </h3>
        <ul className={styles.weekList}>
          {week.exercises.map((e, i) => (
            <li key={`${e.id}-${e.date}-${i}`}>
              {e.trend === 'new' ? (
                <span className={styles.newTag}>New</span>
              ) : (
                <TrendMark trend={e.trend} />
              )}
              <Link to={`/exercises/${e.id}`} className={styles.weekExercise}>
                {e.title}
              </Link>
              <span className={styles.weekMeta}>
                {shortDate(e.date)}
                {e.rep_range && ` · ${e.rep_range}`}
                {e.role === 'secondary' && ' · indirect'}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}

function ExerciseList({ title, entries }: { title: string; entries: StrengthEntry[] }) {
  return (
    <Card title={title}>
      <ul className={styles.list}>
        {entries.map((e) => (
          <li key={e.id}>
            <Link to={`/exercises/${e.id}`} className={styles.row}>
              <span className={styles.rowMain}>
                <span className={styles.rowTitle}>{e.title}</span>
                <span className={styles.rowSub}>
                  {e.mode === 'duration' ? 'Longest hold' : 'Best set'}:{' '}
                  <strong>{formatBestSet(e.best, e.mode)}</strong>
                </span>
              </span>
              <span className={styles.rowSide}>
                {e.est_1rm_kg !== null && (
                  <span className={styles.oneRm}>
                    <small>Est. 1RM</small>
                    {kg(e.est_1rm_kg)} kg
                  </span>
                )}
                <span className={styles.rowTrend}>
                  {e.trend === 'new' ? (
                    <span className={styles.newTag}>New</span>
                  ) : (
                    e.trend && <TrendMark trend={e.trend} />
                  )}
                </span>
                <span aria-hidden="true" className={styles.chevron}>
                  ›
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}

// "Abdominal exercises", not "Abdominals exercises".
const SINGULAR: Record<string, string> = {
  abdominals: 'Abdominal',
  abductors: 'Abductor',
  adductors: 'Adductor',
  calves: 'Calf',
  forearms: 'Forearm',
  glutes: 'Glute',
  hamstrings: 'Hamstring',
  lats: 'Lat',
  shoulders: 'Shoulder',
  traps: 'Trap',
}

function exerciseAdjective(muscle: Muscle): string {
  return SINGULAR[muscle.group] ?? muscle.label
}
