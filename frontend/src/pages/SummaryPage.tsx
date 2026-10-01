import { Link } from 'react-router'
import { useBodyMap } from '../api/client'
import type { MuscleState } from '../api/types'
import { STATE_STYLES } from '../bodymap/states'
import { ErrorMessage, Loading } from '../components/Feedback'
import styles from './SummaryPage.module.css'

const ORDER: MuscleState[] = [
  'progressing',
  'not_progressing',
  'declining',
  'no_status',
  'indirect_only',
]

const SYMBOL_COLOURS: Partial<Record<MuscleState, string>> = {
  progressing: 'var(--progressing)',
  not_progressing: 'var(--not-progressing)',
  declining: 'var(--declining)',
}

/** Every muscle grouped by status: the body map as a list, readable without colour. */
export function SummaryPage() {
  const { data, error, isPending } = useBodyMap()

  return (
    <>
      <h1 className={styles.title}>Summary</h1>
      <p className={styles.subtitle}>Every muscle you've trained, by how it's progressing.</p>
      {isPending && <Loading label="Loading your progress" />}
      {error && <ErrorMessage error={error} />}
      {data && (
        <section className={styles.list} aria-label="Muscles by status">
          {ORDER.map((state) => {
            const inState = data.muscles.filter((m) => m.state === state)
            if (inState.length === 0) return null
            const { symbol, label } = STATE_STYLES[state]
            return (
              <div key={state} className={styles.group}>
                <h2 className={styles.groupTitle}>
                  <span style={{ color: SYMBOL_COLOURS[state] }} aria-hidden="true">
                    {symbol}
                  </span>{' '}
                  {label} <span className={styles.count}>{inState.length}</span>
                </h2>
                <div className={styles.chips}>
                  {inState.map((m) => (
                    <Link key={m.group} to={`/muscles/${m.group}`} className={styles.chip}>
                      {m.label}
                      {m.stale && <span className={styles.staleTag}>3 wk+</span>}
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
        </section>
      )}
    </>
  )
}
