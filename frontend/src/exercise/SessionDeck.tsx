import { useState } from 'react'
import type { Mode, Plan, Session } from '../api/types'
import { formatSet, formatTarget, plural, shortDate } from '../format'
import { planNote } from './planNote'
import styles from './SessionDeck.module.css'

const TITLES = ['Last session', 'This session', 'Next session']
const THIS_SESSION = 1

/**
 * Last · This · Next session side by side, all on screen at once: this session in
 * the middle and in front; tap Last or Next to bring it forward instead.
 */
export function SessionDeck({ last, plan, mode }: { last: Session; plan: Plan; mode: Mode }) {
  const [active, setActive] = useState(THIS_SESSION)

  return (
    <section className={styles.deck} aria-label="Sessions">
      {TITLES.map((title, i) => (
        <article
          key={title}
          className={styles.card}
          data-active={i === active || undefined}
          data-this={i === THIS_SESSION || undefined}
          aria-label={title}
          aria-current={i === active || undefined}
          tabIndex={0}
          onClick={() => setActive(i)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setActive(i)
            }
          }}
        >
          {i === 0 && <LastCard session={last} mode={mode} />}
          {i === 1 && <ThisCard plan={plan} mode={mode} />}
          {i === 2 && <NextCard plan={plan} mode={mode} />}
        </article>
      ))}
    </section>
  )
}

function LastCard({ session, mode }: { session: Session; mode: Mode }) {
  const result = session.vs_target === 1 ? 'beaten' : session.vs_target === 0 ? 'hit' : 'missed'
  return (
    <>
      <p className={styles.kicker}>Last session</p>
      <p className={styles.when}>{shortDate(session.date)}</p>
      <p className={styles.big}>{formatSet(session.did, mode)}</p>
      <p className={styles.detail}>
        {session.target === null ? (
          'First session: your starting point'
        ) : (
          <>
            Target was {formatTarget(session.target, mode)} ·{' '}
            <span className={styles.vs} data-missed={session.vs_target === -1 || undefined}>
              {session.vs_target === -1 ? '✗' : '✓'} {result}
            </span>
          </>
        )}
      </p>
    </>
  )
}

function ThisCard({ plan, mode }: { plan: Plan; mode: Mode }) {
  return (
    <>
      <p className={styles.kicker}>This session</p>
      {plan.ahead_of_plan && <p className={styles.ahead}>Ahead of plan</p>}
      <p className={styles.big}>{formatTarget(plan.today, mode)}</p>
      <p className={styles.detail}>
        {plan.today.sets > 1 && <>{plural(plan.today.sets, 'set')} · </>}
        {planNote(plan, mode)}
      </p>
    </>
  )
}

function NextCard({ plan, mode }: { plan: Plan; mode: Mode }) {
  return (
    <>
      <p className={styles.kicker}>Next session</p>
      <p className={styles.big}>{formatTarget(plan.then, mode)}</p>
      <p className={styles.detail}>If you hit this session's target</p>
    </>
  )
}
