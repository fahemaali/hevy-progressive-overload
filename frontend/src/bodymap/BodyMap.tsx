import { useState } from 'react'
import type { BodyMapMuscle } from '../api/types'
import { REGIONS, VIEW_BOXES, type View } from './regions'
import { STATE_STYLES, STATUS_STATES } from './states'
import styles from './BodyMap.module.css'

interface Props {
  muscles: BodyMapMuscle[]
  onSelect: (group: string) => void
  selected?: string | null // highlighted as the current choice
}

// Drawn in this order, so slim muscles come last: where their enlarged tap areas
// overlap a bigger neighbour, the slim muscle wins.
const DRAW_ORDER = [
  'chest',
  'abdominals',
  'quadriceps',
  'lats',
  'upper_back',
  'lower_back',
  'glutes',
  'hamstrings',
  'shoulders',
  'traps',
  'biceps',
  'triceps',
  'forearms',
  'calves',
  'neck',
  'abductors',
  'adductors',
]

/** Front and back figures, each muscle group coloured by its state. */
export function BodyMap({ muscles, onSelect, selected }: Props) {
  const byGroup = new Map(muscles.map((m) => [m.group, m]))
  const [hovered, setHovered] = useState<string | null>(null)

  return (
    <div className={styles.figures}>
      <svg width="0" height="0" aria-hidden="true" className={styles.defs}>
        <StripePatterns />
      </svg>
      {(['front', 'back'] as View[]).map((view) => (
        <figure key={view} className={styles.figure}>
          <svg
            viewBox={VIEW_BOXES[view]}
            className={styles.svg}
            role="group"
            aria-label={`${view} view`}
          >
            {REGIONS[view]
              .filter((r) => r.group === null)
              .map((r) => (
                <path key={r.id} d={r.path} className={styles.figurePart} />
              ))}
            {DRAW_ORDER.map((group) => {
              const muscle = byGroup.get(group)
              const regions = REGIONS[view].filter((r) => r.group === group)
              if (!muscle || regions.length === 0) return null
              const style = STATE_STYLES[muscle.state]
              // Stripes only apply to the three progress statuses.
              const striped = muscle.stale && STATUS_STATES.includes(muscle.state)
              const fill = striped ? `url(#stale-${muscle.state})` : style.color
              const label = `${muscle.label}: ${style.label}${striped ? ', not trained in 3+ weeks' : ''}`
              return (
                <g
                  key={group}
                  role="button"
                  tabIndex={0}
                  aria-label={label}
                  className={styles.muscle}
                  data-hovered={hovered === group || undefined}
                  data-selected={selected === group || undefined}
                  aria-pressed={selected === group}
                  onClick={() => onSelect(group)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelect(group)
                    }
                  }}
                  onPointerEnter={() => setHovered(group)}
                  onPointerLeave={() => setHovered(null)}
                >
                  <title>{label}</title>
                  {regions.map((r) => (
                    <path key={r.id} d={r.path} fill={fill} className={styles.shape} />
                  ))}
                  {/* Invisible, wider outlines: a bigger area to tap than the shape itself. */}
                  {regions.map((r) => (
                    <path key={`${r.id}-hit`} d={r.path} className={styles.hitArea} />
                  ))}
                </g>
              )
            })}
          </svg>
          <figcaption className={styles.caption}>{view === 'front' ? 'Front' : 'Back'}</figcaption>
        </figure>
      ))}
    </div>
  )
}

/** Diagonal stripes of each status colour, for muscles not trained recently. */
function StripePatterns() {
  return (
    <defs>
      {STATUS_STATES.map((state) => (
        <pattern
          key={state}
          id={`stale-${state}`}
          width="1.6"
          height="1.6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="1.6" height="1.6" fill="var(--map-figure)" />
          <rect width="0.8" height="1.6" fill={STATE_STYLES[state].color} />
        </pattern>
      ))}
    </defs>
  )
}
