import { useState } from 'react'
import { useNextSession } from '../api/client'
import type { NextSession } from '../api/types'
import { ErrorMessage, Loading } from '../components/Feedback'
import { MuscleOptions } from '../session/MuscleOptions'
import { closestRoutine } from '../session/routineMatch'
import styles from './NextSessionPage.module.css'

// The mobility card's key among the chosen options (no muscle has this name).
const MOBILITY = 'mobility'

/**
 * The next session to do: each muscle with its favourite exercise and alternatives a
 * swipe away, then optional mobility (pick one). A low energy day drops a set from each
 * exercise (same targets, so every set done is still progress) and leaves out the extras.
 */
export function NextSessionPage() {
  const { data, error, isPending } = useNextSession()
  const [lowEnergy, setLowEnergy] = useState(false)

  return (
    <>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>Next session</h1>
        <button
          type="button"
          className={styles.energy}
          aria-pressed={lowEnergy}
          onClick={() => setLowEnergy(!lowEnergy)}
        >
          Low energy day
        </button>
      </div>
      {isPending && <Loading label="Planning your next session" />}
      {error && <ErrorMessage error={error} />}
      {data && <Session session={data} lowEnergy={lowEnergy} />}
    </>
  )
}

function Session({ session, lowEnergy }: { session: NextSession; lowEnergy: boolean }) {
  // Which option each muscle is showing (0 = the main one).
  const [chosen, setChosen] = useState<Record<string, number>>({})

  if (session.muscles.length === 0) {
    return <p className={styles.empty}>Log a workout in Hevy to get your next session.</p>
  }

  const muscles = session.muscles.filter((m) => !lowEnergy || !m.extra)
  const match = closestRoutine(
    muscles.map((m) => m.options[chosen[m.group] ?? 0]),
    session.routines,
  )

  return (
    <>
      {muscles.map((muscle) => (
        <MuscleOptions
          key={muscle.group}
          muscle={muscle}
          chosen={chosen[muscle.group] ?? 0}
          onChoose={(i) => setChosen((c) => ({ ...c, [muscle.group]: i }))}
          lowEnergy={lowEnergy}
        />
      ))}

      {/* Pick one: the same swipe card as a muscle, so it reads as a choice, not a list. */}
      {!lowEnergy && session.mobility.length > 0 && (
        <MuscleOptions
          muscle={{
            group: MOBILITY,
            label: 'Mobility · pick one',
            state: 'no_status',
            days_since_trained: null,
            extra: true,
            options: session.mobility,
          }}
          chosen={chosen[MOBILITY] ?? 0}
          onChoose={(i) => setChosen((c) => ({ ...c, [MOBILITY]: i }))}
          lowEnergy={lowEnergy}
          aside="Optional"
        />
      )}

      {match && (
        <p className={styles.base}>
          Based on <strong>{match.title}</strong>
          {match.add.length > 0 && <span>Add {match.add.join(', ')}</span>}
          {match.remove.length > 0 && <span>Remove {match.remove.join(', ')}</span>}
        </p>
      )}
    </>
  )
}
