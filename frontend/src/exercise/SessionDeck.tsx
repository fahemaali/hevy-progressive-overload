import { useLayoutEffect, useRef, useState } from 'react'
import type { Mode, Plan, Session } from '../api/types'
import { formatSet, formatTarget, plural, shortDate } from '../format'
import { planNote } from './planNote'
import styles from './SessionDeck.module.css'

const TITLES = ['Last session', 'This session', 'Next session']
const THIS_SESSION = 1

/**
 * Last · This · Next session as a deck of cards: this session in front and centre,
 * the other two peeking out behind it. Swipe, or use the arrows or dots.
 */
export function SessionDeck({ last, plan, mode }: { last: Session; plan: Plan; mode: Mode }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(THIS_SESSION)

  const scrollTo = (index: number, smooth = true) => {
    const track = trackRef.current
    const card = track?.children[index] as HTMLElement | undefined
    if (!track || !card) return
    const left = card.offsetLeft - (track.clientWidth - card.clientWidth) / 2
    track.scrollTo?.({ left, behavior: smooth ? 'smooth' : 'auto' })
  }

  const go = (index: number) => {
    setActive(index)
    scrollTo(index)
  }

  // Start with this session centred.
  useLayoutEffect(() => scrollTo(THIS_SESSION, false), [])

  // When swiping, the card nearest the middle becomes the active one.
  const onScroll = () => {
    const track = trackRef.current
    if (!track) return
    const middle = track.scrollLeft + track.clientWidth / 2
    const cards = [...track.children] as HTMLElement[]
    const nearest = cards.reduce(
      (best, card, i) => {
        const distance = Math.abs(card.offsetLeft + card.clientWidth / 2 - middle)
        return distance < best.distance ? { i, distance } : best
      },
      { i: active, distance: Infinity },
    )
    if (nearest.i !== active) setActive(nearest.i)
  }

  return (
    <section className={styles.deck} aria-roledescription="carousel" aria-label="Sessions">
      <div className={styles.track} ref={trackRef} onScroll={onScroll}>
        {TITLES.map((title, i) => (
          <article
            key={title}
            className={styles.card}
            data-active={i === active || undefined}
            data-this={i === THIS_SESSION || undefined}
            aria-roledescription="slide"
            aria-label={`${title}, ${i + 1} of 3`}
            aria-hidden={i !== active}
            onClick={() => i !== active && go(i)}
          >
            {i === 0 && <LastCard session={last} mode={mode} />}
            {i === 1 && <ThisCard plan={plan} mode={mode} />}
            {i === 2 && <NextCard plan={plan} mode={mode} />}
          </article>
        ))}
      </div>

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.arrow}
          aria-label="Previous session"
          disabled={active === 0}
          onClick={() => go(active - 1)}
        >
          ‹
        </button>
        <div className={styles.dots} role="tablist" aria-label="Choose a session">
          {TITLES.map((title, i) => (
            <button
              key={title}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={title}
              className={styles.dot}
              onClick={() => go(i)}
            />
          ))}
        </div>
        <button
          type="button"
          className={styles.arrow}
          aria-label="Next session"
          disabled={active === TITLES.length - 1}
          onClick={() => go(active + 1)}
        >
          ›
        </button>
      </div>
    </section>
  )
}

function LastCard({ session, mode }: { session: Session; mode: Mode }) {
  const result = session.vs_target === 1 ? 'beaten' : session.vs_target === 0 ? 'hit' : 'missed'
  return (
    <>
      <p className={styles.kicker}>
        Last session <span>· {shortDate(session.date)}</span>
      </p>
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
      <p className={styles.kicker}>
        This session
        {plan.ahead_of_plan && <span className={styles.ahead}>Ahead of plan</span>}
      </p>
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
