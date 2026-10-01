import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useSearch } from '../api/client'
import styles from './SearchBar.module.css'

const DEBOUNCE_MS = 150

/** Find an exercise or muscle fast, mid-workout. Empty: your most recent exercises. */
export function SearchBar() {
  const [text, setText] = useState('')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const { data, isFetching } = useSearch(query, open)

  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [text])

  // Close when tapping anywhere else.
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  const results = data && (data.muscles.length > 0 || data.exercises.length > 0) ? data : null

  return (
    <div className={styles.search} ref={containerRef}>
      <label htmlFor={`${listId}-input`} className="visually-hidden">
        Search exercises and muscles
      </label>
      <input
        id={`${listId}-input`}
        type="search"
        className={styles.input}
        placeholder="Search exercises or muscles"
        value={text}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        onChange={(e) => {
          setText(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
      />
      {open && (
        <div id={listId} className={styles.results} role="listbox" aria-busy={isFetching}>
          {!query && results && <p className={styles.heading}>Recent</p>}
          {results?.muscles.map((m) => (
            <Link key={m.group} to={`/muscles/${m.group}`} className={styles.result} role="option">
              <span>{m.label}</span>
              <span className={styles.meta}>Muscle</span>
            </Link>
          ))}
          {results?.exercises.map((e) => (
            <Link key={e.id} to={`/exercises/${e.id}`} className={styles.result} role="option">
              <span>{e.title}</span>
              <span className={styles.meta}>{e.primary_muscle.replaceAll('_', ' ')}</span>
            </Link>
          ))}
          {data && !results && <p className={styles.empty}>No matches</p>}
        </div>
      )}
    </div>
  )
}
