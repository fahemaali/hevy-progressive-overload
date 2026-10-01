import { Link } from 'react-router'
import { useExercises, useMuscle } from '../api/client'
import type { ExerciseSummary } from '../api/types'
import { STATE_STYLES, STATUS_STATES } from '../bodymap/states'
import { ErrorMessage, Loading } from '../components/Feedback'
import { TrendMark } from '../components/TrendMark'
import { SessionDeck } from '../exercise/SessionDeck'
import { pct } from '../format'
import { muscleLabel } from '../muscles'
import { RANGE_NAMES } from '../ranges'
import styles from './MuscleSpotlight.module.css'

/**
 * Under the body map: the chosen muscle's headline (tap for its full page), then a
 * row per exercise that works it directly, each with its Last · This · Next cards.
 */
export function MuscleSpotlight({ group }: { group: string }) {
  const muscle = useMuscle(group)
  const exercises = useExercises()
  const label = muscle.data?.label ?? muscleLabel(group)
  const rows = (exercises.data ?? []).filter((e) => e.primary_muscle === group)
  const state = muscle.data?.state
  const hasStatus = state !== undefined && STATUS_STATES.includes(state)

  return (
    <section className={styles.spotlight} aria-label={`${label} exercises`}>
      <Link to={`/muscles/${group}`} className={styles.header}>
        <span className={styles.heading}>
          {hasStatus && (
            <span
              className={styles.symbol}
              style={{ color: STATE_STYLES[state].color }}
              aria-hidden="true"
            >
              {STATE_STYLES[state].symbol}
            </span>
          )}
          <h2 className={styles.name}>{label}</h2>
          {muscle.data?.change_pct != null && (
            <span className={styles.change}>{pct(muscle.data.change_pct)}</span>
          )}
        </span>
        <span className={styles.more}>
          Week by week <span aria-hidden="true">›</span>
        </span>
      </Link>

      {exercises.isPending && <Loading label="Loading exercises" />}
      {exercises.error && <ErrorMessage error={exercises.error} />}
      {exercises.data && rows.length === 0 && (
        <p className={styles.empty}>No exercises work {label.toLowerCase()} directly yet.</p>
      )}

      <ul className={styles.rows}>
        {rows.map((e, i) => (
          <ExerciseRow key={e.id} exercise={e} index={i} />
        ))}
      </ul>
    </section>
  )
}

function ExerciseRow({ exercise, index }: { exercise: ExerciseSummary; index: number }) {
  return (
    <li className={styles.row} style={{ '--i': index } as React.CSSProperties}>
      <div className={styles.rowHeader}>
        <Link to={`/exercises/${exercise.id}`} className={styles.rowTitle}>
          {exercise.title}
          <span aria-hidden="true" className={styles.chevron}>
            ›
          </span>
        </Link>
        <span className={styles.rowMeta}>
          {exercise.rep_range && (
            <span className={styles.range}>{RANGE_NAMES[exercise.rep_range]}</span>
          )}
          {exercise.trend === 'new' ? (
            <span className={styles.newTag}>New</span>
          ) : (
            <span className={styles.trend}>
              <TrendMark trend={exercise.trend} />
              {exercise.change_pct !== null && pct(exercise.change_pct)}
            </span>
          )}
        </span>
      </div>
      <SessionDeck
        sessions={[exercise.last]}
        plan={exercise.plan}
        mode={exercise.mode}
        compact
        label={`${exercise.title} sessions`}
      />
    </li>
  )
}
