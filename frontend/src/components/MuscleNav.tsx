import { NavLink } from 'react-router'
import { useBodyMap } from '../api/client'
import { STATE_STYLES, STATUS_STATES } from '../bodymap/states'
import { trackedMuscles } from '../muscles'
import styles from './MuscleNav.module.css'

/** Muscles you train, alphabetically, each with its current status symbol. */
export function MuscleNav({ className }: { className?: string }) {
  const { data } = useBodyMap()
  const muscles = trackedMuscles(data?.muscles ?? [])
  if (muscles.length === 0) return null

  return (
    <ul className={`${styles.list} ${className ?? ''}`}>
      {muscles.map((m) => {
        const style = STATE_STYLES[m.state]
        const hasStatus = STATUS_STATES.includes(m.state)
        return (
          <li key={m.group}>
            <NavLink
              to={`/muscles/${m.group}`}
              className={({ isActive }) =>
                isActive ? `${styles.link} ${styles.active}` : styles.link
              }
            >
              <span>{m.label}</span>
              <span
                className={styles.symbol}
                style={{ color: hasStatus ? style.color : 'var(--text-muted)' }}
                aria-label={style.label + (m.stale ? ', not trained in 3+ weeks' : '')}
                role="img"
              >
                {hasStatus ? style.symbol : '–'}
              </span>
            </NavLink>
          </li>
        )
      })}
    </ul>
  )
}
