import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useSearch } from '../api/client'
import { CloseIcon, SearchIcon } from './icons'
import styles from './SearchBar.module.css'

const DEBOUNCE_MS = 150

/**
 * A search icon in the header that opens a compact search panel: find an exercise
 * or muscle fast, mid-workout. Before typing, it lists your most recent exercises.
 */
export function SearchBar() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const id = useId()
  const { data, isFetching } = useSearch(query, open)

  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [text])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

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
  const choose = () => {
    setOpen(false)
    setText('')
  }

  return (
    <div className={styles.search} ref={containerRef}>
      <button
        type="button"
        className={styles.toggle}
        aria-label={open ? 'Close search' : 'Search exercises and muscles'}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <CloseIcon /> : <SearchIcon />}
      </button>

      {open && (
        <div className={styles.panel}>
          <label htmlFor={`${id}-input`} className="visually-hidden">
            Search exercises and muscles
          </label>
          <input
            ref={inputRef}
            id={`${id}-input`}
            type="search"
            className={styles.input}
            placeholder="Search exercises or muscles"
            value={text}
            autoComplete="off"
            role="combobox"
            aria-expanded="true"
            aria-controls={`${id}-list`}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
          />
          <div id={`${id}-list`} className={styles.results} role="listbox" aria-busy={isFetching}>
            {!query && results && <p className={styles.heading}>Recent</p>}
            {results?.muscles.map((m) => (
              <Link
                key={m.group}
                to={`/muscles/${m.group}`}
                className={styles.result}
                role="option"
                onClick={choose}
              >
                <span>{m.label}</span>
                <span className={styles.meta}>Muscle</span>
              </Link>
            ))}
            {results?.exercises.map((e) => (
              <Link
                key={e.id}
                to={`/exercises/${e.id}`}
                className={styles.result}
                role="option"
                onClick={choose}
              >
                <span>{e.title}</span>
                <span className={styles.meta}>{e.primary_muscle.replaceAll('_', ' ')}</span>
              </Link>
            ))}
            {data && !results && <p className={styles.empty}>No matches</p>}
          </div>
        </div>
      )}
    </div>
  )
}
