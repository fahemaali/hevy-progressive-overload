import { useNavigate } from 'react-router'
import { useBodyMap } from '../api/client'
import { BodyMap } from '../bodymap/BodyMap'
import { STATE_STYLES, STATUS_STATES } from '../bodymap/states'
import { ErrorMessage, Loading } from '../components/Feedback'
import styles from './HomePage.module.css'

export function HomePage() {
  const navigate = useNavigate()
  const { data, error, isPending } = useBodyMap()

  return (
    <>
      <section className={styles.card} aria-labelledby="map-title">
        <div className={styles.cardHeader}>
          <h1 id="map-title" className={styles.title}>
            Your muscles
          </h1>
        </div>
        {isPending && <Loading label="Loading your progress" />}
        {error && <ErrorMessage error={error} />}
        {data && (
          <>
            <BodyMap muscles={data.muscles} onSelect={(group) => navigate(`/muscles/${group}`)} />
            <Legend />
          </>
        )}
      </section>
    </>
  )
}

function Legend() {
  return (
    <ul className={styles.legend} aria-label="Legend">
      {STATUS_STATES.map((state) => (
        <li key={state}>
          <span className={styles.swatch} style={{ background: STATE_STYLES[state].color }} />
          {STATE_STYLES[state].label}
        </li>
      ))}
      <li>
        <span className={`${styles.swatch} ${styles.stripes}`} />
        Not trained in 3+ weeks
      </li>
    </ul>
  )
}
