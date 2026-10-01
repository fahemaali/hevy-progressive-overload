import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useBodyMap } from '../api/client'
import { BodyMap } from '../bodymap/BodyMap'
import { STATE_STYLES, STATUS_STATES } from '../bodymap/states'
import { ErrorMessage, Loading } from '../components/Feedback'
import { LogoMark } from '../components/Logo'
import { SyncStatus } from '../components/SyncStatus'
import { readFlag, writeFlag } from '../storage'
import styles from './HomePage.module.css'

const INTRO_DISMISSED = 'intro-dismissed'

export function HomePage() {
  const navigate = useNavigate()
  const { data, error, isPending } = useBodyMap()

  return (
    <>
      <Intro />
      <section className={styles.card} aria-labelledby="map-title">
        <div className={styles.cardHeader}>
          <h1 id="map-title" className={styles.title}>
            Your muscles
          </h1>
          <span className={styles.syncOnPhone}>
            <SyncStatus />
          </span>
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

/** A one-line explanation for first-time visitors, until they dismiss it. */
function Intro() {
  const [dismissed, setDismissed] = useState(() => readFlag(INTRO_DISMISSED))
  if (dismissed) return null
  return (
    <section className={styles.intro} aria-label="About this app">
      <LogoMark size={40} />
      <div>
        <p className={styles.introText}>
          <strong>Next Set</strong> turns Hevy workouts into a progressive overload plan: see which
          muscles are getting stronger, then get a target for every exercise.
        </p>
        <div className={styles.introActions}>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => {
              writeFlag(INTRO_DISMISSED)
              setDismissed(true)
            }}
          >
            Got it
          </button>
          <Link to="/about" className={styles.textLink}>
            How it works
          </Link>
        </div>
      </div>
    </section>
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
