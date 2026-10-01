import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useMuscle } from '../api/client'
import type { Muscle, MuscleWeek, StrengthEntry } from '../api/types'
import { STATE_STYLES, STATUS_STATES } from '../bodymap/states'
import { BackLink } from '../components/BackLink'
import { Card } from '../components/Card'
import { ErrorMessage, Loading } from '../components/Feedback'
import { TrendMark } from '../components/TrendMark'
import { TREND_INFO } from '../trends'
import { formatSet, shortDate } from '../format'
import styles from './MusclePage.module.css'

export function MusclePage() {
  const { group = '' } = useParams()
  const { data, error, isPending } = useMuscle(group)

  return (
    <>
      <BackLink fallback="/" label="Body map" />
      {isPending && <Loading label="Loading muscle" />}
      {error && <ErrorMessage error={error} />}
      {data && <MuscleView muscle={data} />}
    </>
  )
}

function MuscleView({ muscle }: { muscle: Muscle }) {
  const direct = muscle.exercises.filter((e) => e.role === 'primary')
  const indirect = muscle.exercises.filter((e) => e.role === 'secondary')
  const hasStatus = STATUS_STATES.includes(muscle.state)

  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.title}>{muscle.label}</h1>
        <span className={styles.status}>
          {hasStatus && (
            <span
              className={styles.dot}
              style={{ background: STATE_STYLES[muscle.state].color }}
              aria-hidden="true"
            />
          )}
          {STATE_STYLES[muscle.state].label}
          {muscle.stale && <span className={styles.stale}> · not trained in 3+ weeks</span>}
        </span>
      </header>

      {muscle.weeks.length > 0 && <WeekByWeek weeks={muscle.weeks} />}

      {muscle.exercises.length === 0 ? (
        <Card>
          <p className={styles.empty}>No exercises for this muscle yet.</p>
        </Card>
      ) : (
        <>
          {direct.length > 0 && <ExerciseList title="Exercises" entries={direct} />}
          {indirect.length > 0 && <ExerciseList title="Also works it" entries={indirect} />}
        </>
      )}
    </>
  )
}

/** A strip of recent weeks, coloured by status; pick one to see its exercises. */
function WeekByWeek({ weeks }: { weeks: MuscleWeek[] }) {
  const lastJudged = weeks.findLastIndex((w) => w.trend !== 'insufficient')
  const [selected, setSelected] = useState(lastJudged >= 0 ? lastJudged : weeks.length - 1)
  const week = weeks[selected]

  return (
    <Card title="Week by week">
      <div className={styles.strip} role="radiogroup" aria-label="Week">
        {weeks.map((w, i) => {
          const info = TREND_INFO[w.trend]
          const judged = w.trend === 'up' || w.trend === 'flat' || w.trend === 'down'
          return (
            <button
              key={w.week_start}
              type="button"
              role="radio"
              aria-checked={i === selected}
              aria-label={`Week of ${shortDate(w.week_start)}: ${info.label}`}
              className={styles.week}
              data-selected={i === selected || undefined}
              style={judged ? { background: info.color, color: '#fff' } : undefined}
              onClick={() => setSelected(i)}
            >
              <span aria-hidden="true">{judged ? info.symbol : ''}</span>
            </button>
          )
        })}
      </div>
      <div className={styles.stripDates} aria-hidden="true">
        <span>{shortDate(weeks[0].week_start)}</span>
        {weeks.length > 1 && <span>{shortDate(weeks[weeks.length - 1].week_start)}</span>}
      </div>

      <div className={styles.weekDetail} aria-live="polite">
        <h3 className={styles.weekTitle}>
          Week of {shortDate(week.week_start)} · <TrendMark trend={week.trend} showLabel />
        </h3>
        <ul className={styles.weekList}>
          {week.exercises.map((e, i) => (
            <li key={`${e.id}-${i}`}>
              <TrendMark trend={e.trend} />
              <Link to={`/exercises/${e.id}`}>{e.title}</Link>
              {e.role === 'secondary' && <span className={styles.tag}>indirect</span>}
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
                  {`${formatSet(e.latest, e.mode)} · ${shortDate(e.last_trained)}`}
                </span>
              </span>
              <span className={styles.rowSide}>
                {e.est_1rm_kg !== null && (
                  <span className={styles.oneRm}>
                    {e.est_1rm_kg} <small>kg 1RM</small>
                  </span>
                )}
                {e.trend && <TrendMark trend={e.trend} />}
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
