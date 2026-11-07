import { Fragment, useRef } from 'react'
import type { MuscleState, SessionMuscle } from '../api/types'
import { TrendMark } from '../components/TrendMark'
import { formatTarget, plural } from '../format'
import styles from './MuscleOptions.module.css'
import { lastTrained, setsFor } from './sessionText'

const STATE_TRENDS = {
  progressing: 'up',
  not_progressing: 'flat',
  declining: 'down',
} as const satisfies Partial<Record<MuscleState, string>>

/**
 * A muscle's card: its main exercise, with the alternatives a swipe away. A faint "or"
 * sits between them, peeking in at the right edge, so it's clear there's a choice.
 */
export function MuscleOptions({
  muscle,
  chosen,
  onChoose,
  lowEnergy,
  aside,
}: {
  muscle: SessionMuscle
  chosen: number
  onChoose: (index: number) => void
  lowEnergy: boolean
  aside?: string // shown on the right of the header, instead of when it was last trained
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const trend =
    muscle.state in STATE_TRENDS ? STATE_TRENDS[muscle.state as keyof typeof STATE_TRENDS] : null
  const slides = () => [...(trackRef.current?.querySelectorAll<HTMLElement>('[data-slide]') ?? [])]

  const choose = (index: number) => {
    onChoose(index)
    const slide = slides()[index]
    trackRef.current?.scrollTo?.({ left: slide?.offsetLeft ?? 0, behavior: 'smooth' })
  }

  // When swiping, the option nearest the left edge becomes the chosen one.
  const onScroll = () => {
    const track = trackRef.current
    if (!track) return
    const nearest = slides().reduce(
      (best, slide, i) => {
        const distance = Math.abs(slide.offsetLeft - track.scrollLeft)
        return distance < best.distance ? { i, distance } : best
      },
      { i: chosen, distance: Infinity },
    )
    if (nearest.i !== chosen) onChoose(nearest.i)
  }

  return (
    <section className={styles.card} aria-label={muscle.label}>
      <div className={styles.header}>
        <h2 className={styles.muscle}>
          {muscle.label}
          {trend && <TrendMark trend={trend} />}
        </h2>
        {aside !== undefined ? (
          <span className={styles.ago}>{aside}</span>
        ) : (
          muscle.days_since_trained !== null && (
            <span className={styles.ago}>{lastTrained(muscle.days_since_trained)}</span>
          )
        )}
      </div>

      <div
        className={styles.track}
        data-single={muscle.options.length === 1 || undefined}
        ref={trackRef}
        onScroll={onScroll}
        aria-roledescription="carousel"
        aria-label={`${muscle.label} exercises`}
      >
        {muscle.options.map((option, i) => {
          const sets = setsFor(option.target.sets, lowEnergy)
          return (
            <Fragment key={option.id}>
              {i > 0 && (
                <span className={styles.or} aria-hidden="true">
                  or
                </span>
              )}
              <div
                className={styles.slide}
                data-slide
                role="group"
                aria-roledescription="slide"
                aria-label={`${option.title}, ${i + 1} of ${muscle.options.length}`}
                aria-hidden={i !== chosen}
              >
                <p className={styles.name}>
                  {option.title}
                  {option.favourite && (
                    <span className={styles.star} title="Favourite">
                      <span aria-hidden="true">★</span>
                      <span className="visually-hidden">Favourite</span>
                    </span>
                  )}
                </p>
                <p className={styles.target}>
                  {formatTarget(option.target, option.mode)}
                  {sets > 1 && <span className={styles.sets}>{plural(sets, 'set')}</span>}
                </p>
              </div>
            </Fragment>
          )
        })}
        {muscle.options.length > 1 && <span className={styles.end} aria-hidden="true" />}
      </div>

      {muscle.options.length > 1 && (
        <div
          className={styles.dots}
          role="tablist"
          aria-label={`Choose a ${muscle.label.toLowerCase()} exercise`}
        >
          {muscle.options.map((option, i) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={i === chosen}
              aria-label={option.title}
              className={styles.dot}
              onClick={() => choose(i)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
