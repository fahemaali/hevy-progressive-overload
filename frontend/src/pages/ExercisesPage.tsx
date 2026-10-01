import { Link } from 'react-router'
import { useExercises } from '../api/client'
import type { ExerciseSummary } from '../api/types'
import { Card } from '../components/Card'
import { ErrorMessage, Loading } from '../components/Feedback'
import { TrendMark } from '../components/TrendMark'
import { formatTarget } from '../format'
import { muscleLabel } from '../muscles'
import styles from './ExercisesPage.module.css'

/** Every exercise you've done, grouped by the muscle it mainly works. */
export function ExercisesPage() {
  const { data, error, isPending } = useExercises()

  const groups = new Map<string, ExerciseSummary[]>()
  for (const e of data ?? []) {
    groups.set(e.primary_muscle, [...(groups.get(e.primary_muscle) ?? []), e])
  }

  return (
    <>
      <h1 className={styles.title}>Exercises</h1>
      {isPending && <Loading label="Loading exercises" />}
      {error && <ErrorMessage error={error} />}
      {[...groups].map(([muscle, exercises]) => (
        <Card key={muscle} title={muscleLabel(muscle)}>
          <ul className={styles.list}>
            {exercises.map((e) => (
              <li key={e.id}>
                <Link to={`/exercises/${e.id}`} className={styles.row}>
                  <span className={styles.main}>
                    <span className={styles.name}>{e.title}</span>
                    <span className={styles.sub}>
                      This session: <strong>{formatTarget(e.plan.today, e.mode)}</strong>
                    </span>
                  </span>
                  <span className={styles.side}>
                    {e.trend === 'new' ? (
                      <span className={styles.newTag}>New</span>
                    ) : (
                      <TrendMark trend={e.trend} />
                    )}
                    <span aria-hidden="true" className={styles.chevron}>
                      ›
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </>
  )
}
