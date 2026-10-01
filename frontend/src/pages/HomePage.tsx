import { Link, useNavigate } from 'react-router'
import { useBodyMap } from '../api/client'
import type { BodyMapMuscle, MuscleState } from '../api/types'
import { BodyMap } from '../bodymap/BodyMap'
import { STATE_STYLES } from '../bodymap/states'
import { SearchBar } from '../components/SearchBar'
import { ErrorMessage, Loading } from '../components/Feedback'
import styles from './HomePage.module.css'

// The order states are listed in, and which appear in the legend.
const LIST_ORDER: MuscleState[] = [
  'progressing',
  'not_progressing',
  'declining',
  'no_status',
  'indirect_only',
]
const LEGEND: MuscleState[] = [...LIST_ORDER, 'never_trained']

export function HomePage() {
  const navigate = useNavigate()
  const { data, error, isPending } = useBodyMap()

  return (
    <>
      <div className={styles.search}>
        <SearchBar />
      </div>

      {isPending && <Loading label="Loading your progress" />}
      {error && <ErrorMessage error={error} />}
      {data && (
        <>
          <section className={styles.card} aria-label="Body map">
            <BodyMap muscles={data.muscles} onSelect={(group) => navigate(`/muscles/${group}`)} />
            <Legend />
          </section>
          <MuscleList muscles={data.muscles} />
        </>
      )}
    </>
  )
}

function Legend() {
  return (
    <ul className={styles.legend} aria-label="Legend">
      {LEGEND.map((state) => (
        <li key={state}>
          <span className={styles.swatch} style={{ background: STATE_STYLES[state].color }} />
          {STATE_STYLES[state].label}
        </li>
      ))}
      <li>
        <span className={`${styles.swatch} ${styles.stripes}`} />
        Not trained for 3+ weeks
      </li>
    </ul>
  )
}

/** The same information as the map, as a list: readable without colour, and tappable. */
function MuscleList({ muscles }: { muscles: BodyMapMuscle[] }) {
  return (
    <section className={styles.list} aria-label="Muscles by status">
      {LIST_ORDER.map((state) => {
        const inState = muscles.filter((m) => m.state === state)
        if (inState.length === 0) return null
        const { symbol, label, color } = STATE_STYLES[state]
        return (
          <div key={state} className={styles.group}>
            <h2 className={styles.groupTitle}>
              <span style={{ color }} aria-hidden="true">
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
  )
}
