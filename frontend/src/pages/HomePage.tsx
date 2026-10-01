import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router'
import { useBodyMap } from '../api/client'
import { BodyMap } from '../bodymap/BodyMap'
import { STATE_STYLES, STATUS_STATES } from '../bodymap/states'
import { ErrorMessage, Loading } from '../components/Feedback'
import { MuscleSpotlight } from './MuscleSpotlight'
import styles from './HomePage.module.css'

/**
 * The body map. Tapping a muscle selects it (kept in the address, so refresh, back
 * and shared links keep it) and scrolls down to its exercises.
 */
export function HomePage() {
  const { data, error, isPending } = useBodyMap()
  const [params, setParams] = useSearchParams()
  const selected = params.get('muscle')
  const spotlightRef = useRef<HTMLDivElement>(null)
  const scrollOnChange = useRef(false)

  useEffect(() => {
    if (selected && scrollOnChange.current) {
      spotlightRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
      scrollOnChange.current = false
    }
  }, [selected])

  const select = (group: string) => {
    scrollOnChange.current = true
    setParams({ muscle: group })
  }

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
            <BodyMap muscles={data.muscles} onSelect={select} selected={selected} />
            <Legend />
          </>
        )}
      </section>

      <div ref={spotlightRef} className={styles.spotlightAnchor}>
        {selected ? (
          <MuscleSpotlight key={selected} group={selected} />
        ) : (
          <p className={styles.hint}>Tap a muscle to see its exercises</p>
        )}
      </div>
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
