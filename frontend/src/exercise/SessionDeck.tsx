import { useLayoutEffect, useRef, useState } from 'react'
import type { Mode, Plan, Session } from '../api/types'
import { formatSet, formatTarget, plural, shortDate } from '../format'
import { goalSentence } from './goal'
import styles from './SessionDeck.module.css'

// With more cards than this, a "3 / 12" counter replaces the dots.
const MAX_DOTS = 8

/**
 * Your sessions as a deck of cards: every past session (oldest first), then this
 * session and the next. Opens on this session, in front and centre, with its
 * neighbours peeking out. Swipe, or use the arrows or dots.
 */
export function SessionDeck({
  sessions,
  plan,
  mode,
  compact = false,
  label = 'Sessions',
}: {
  sessions: Session[]
  plan: Plan
  mode: Mode
  compact?: boolean // smaller cards and no controls: for rows of decks
  label?: string
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const thisSession = sessions.length
  const titles = [
    ...sessions.map((s, i) =>
      i === sessions.length - 1 ? 'Last session' : `Session on ${shortDate(s.date)}`,
    ),
    'This session',
    'Next session',
  ]
  const [active, setActive] = useState(thisSession)

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
  useLayoutEffect(() => scrollTo(thisSession, false), [thisSession])

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
    <section
      className={styles.deck}
      data-compact={compact || undefined}
      aria-roledescription="carousel"
      aria-label={label}
    >
      <div className={styles.track} ref={trackRef} onScroll={onScroll}>
        {titles.map((title, i) => (
          <article
            key={title}
            className={styles.card}
            data-active={i === active || undefined}
            data-this={i === thisSession || undefined}
            aria-roledescription="slide"
            aria-label={`${title}, ${i + 1} of ${titles.length}`}
            aria-hidden={i !== active}
            onClick={() => i !== active && go(i)}
          >
            {i < thisSession && (
              <PastCard session={sessions[i]} mode={mode} isLast={i === thisSession - 1} />
            )}
            {i === thisSession && <ThisCard plan={plan} mode={mode} />}
            {i === thisSession + 1 && <NextCard plan={plan} mode={mode} />}
          </article>
        ))}
      </div>

      {!compact && (
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
          {titles.length <= MAX_DOTS ? (
            <div className={styles.dots} role="tablist" aria-label="Choose a session">
              {titles.map((title, i) => (
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
          ) : (
            <span className={styles.counter} aria-live="polite">
              {active + 1} / {titles.length}
            </span>
          )}
          <button
            type="button"
            className={styles.arrow}
            aria-label="Next session"
            disabled={active === titles.length - 1}
            onClick={() => go(active + 1)}
          >
            ›
          </button>
        </div>
      )}
    </section>
  )
}

function PastCard({ session, mode, isLast }: { session: Session; mode: Mode; isLast: boolean }) {
  const result = session.vs_target === 1 ? 'beaten' : session.vs_target === 0 ? 'hit' : 'missed'
  return (
    <>
      <p className={styles.kicker}>
        {isLast ? (
          <>
            Last session <span>· {shortDate(session.date)}</span>
          </>
        ) : (
          shortDate(session.date)
        )}
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
        {goalSentence('this', plan, mode)}
      </p>
    </>
  )
}

function NextCard({ plan, mode }: { plan: Plan; mode: Mode }) {
  return (
    <>
      <p className={styles.kicker}>Next session</p>
      <p className={styles.big}>{formatTarget(plan.then, mode)}</p>
      <p className={styles.detail}>{goalSentence('next', plan, mode)}</p>
    </>
  )
}
