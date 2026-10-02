import { useId, useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import { useExercises } from '../api/client'
import type { ExerciseSummary } from '../api/types'
import { muscleLabel } from '../muscles'
import { TREND_INFO } from '../trends'
import { BodyIcon, ChevronIcon, DumbbellIcon, InfoIcon, ListIcon } from './icons'
import { MuscleNav } from './MuscleNav'
import styles from './SidebarNav.module.css'

type SectionName = 'muscles' | 'exercises'

const STORAGE_KEY = 'next-set:sidebar'
const DEFAULT_OPEN: Record<SectionName, boolean> = { muscles: true, exercises: false }

/**
 * The wide-screen navigation: Body map, then Muscles and Exercises as collapsible
 * sections with their items indented underneath, then About. A section holding the current page
 * opens automatically; otherwise your open/closed choices are remembered.
 */
export function SidebarNav() {
  const { pathname } = useLocation()
  const [choices, setChoices] = useState<Partial<Record<SectionName, boolean>>>(readChoices)

  const inSection = (section: SectionName) => pathname.startsWith(`/${section}/`)
  const isOpen = (section: SectionName) =>
    inSection(section) || (choices[section] ?? DEFAULT_OPEN[section])

  const toggle = (section: SectionName) => {
    const next = { ...choices, [section]: !isOpen(section) }
    setChoices(next)
    writeChoices(next)
  }

  return (
    <nav aria-label="Sidebar" className={styles.nav}>
      <NavLink
        to="/"
        end
        className={({ isActive }) => (isActive ? `${styles.item} ${styles.active}` : styles.item)}
      >
        <BodyIcon />
        <span>Body map</span>
      </NavLink>

      <Section
        label="Muscles"
        Icon={ListIcon}
        open={isOpen('muscles')}
        current={inSection('muscles')}
        onToggle={() => toggle('muscles')}
      >
        <MuscleNav />
      </Section>

      <Section
        label="Exercises"
        Icon={DumbbellIcon}
        open={isOpen('exercises')}
        current={inSection('exercises')}
        onToggle={() => toggle('exercises')}
      >
        <ExerciseNav />
      </Section>

      <NavLink
        to="/about"
        className={({ isActive }) => (isActive ? `${styles.item} ${styles.active}` : styles.item)}
      >
        <InfoIcon />
        <span>About</span>
      </NavLink>
    </nav>
  )
}

function Section({
  label,
  Icon,
  open,
  current,
  onToggle,
  children,
}: {
  label: string
  Icon: React.ComponentType<{ size?: number }>
  open: boolean
  current: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  const id = useId()
  return (
    <div>
      <button
        type="button"
        className={styles.item}
        data-current={current || undefined}
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
      >
        <Icon />
        <span>{label}</span>
        <span className={styles.chevron} data-open={open || undefined} aria-hidden="true">
          <ChevronIcon size={16} />
        </span>
      </button>
      {open && (
        <div id={id} className={styles.children}>
          {children}
        </div>
      )}
    </div>
  )
}

/** Every exercise, grouped under small muscle labels, each with its latest trend. */
function ExerciseNav() {
  const { data } = useExercises()
  const groups = new Map<string, ExerciseSummary[]>()
  for (const e of data ?? []) {
    groups.set(e.primary_muscle, [...(groups.get(e.primary_muscle) ?? []), e])
  }

  return (
    <div className={styles.groups}>
      {[...groups].map(([muscle, exercises]) => (
        <div key={muscle}>
          <p className={styles.groupLabel}>{muscleLabel(muscle)}</p>
          <ul className={styles.list}>
            {exercises.map((e) => {
              const trend = TREND_INFO[e.trend]
              const judged = e.trend === 'up' || e.trend === 'flat' || e.trend === 'down'
              return (
                <li key={e.id}>
                  <NavLink
                    to={`/exercises/${e.id}`}
                    className={({ isActive }) =>
                      isActive ? `${styles.child} ${styles.active}` : styles.child
                    }
                  >
                    <span className={styles.childLabel} title={e.title}>
                      {e.title}
                    </span>
                    {judged && (
                      <span
                        className={styles.symbol}
                        style={{ color: trend.color }}
                        role="img"
                        aria-label={trend.label}
                      >
                        {trend.symbol}
                      </span>
                    )}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

function readChoices(): Partial<Record<SectionName, boolean>> {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<
      Record<SectionName, boolean>
    >
  } catch {
    return {}
  }
}

function writeChoices(choices: Partial<Record<SectionName, boolean>>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(choices))
  } catch {
    // Not remembered this time (e.g. private browsing); harmless.
  }
}
