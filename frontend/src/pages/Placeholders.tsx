import { Link } from 'react-router'
import styles from './Placeholders.module.css'

/** Stands in for screens built later in this phase. */
export function ComingSoon({ what }: { what: string }) {
  return (
    <div className={styles.box}>
      <h1>{what}</h1>
      <p>This screen is coming next.</p>
      <Link to="/" className={styles.link}>
        ← Back to body map
      </Link>
    </div>
  )
}

export function NotFound() {
  return (
    <div className={styles.box}>
      <h1>Page not found</h1>
      <Link to="/" className={styles.link}>
        ← Back to body map
      </Link>
    </div>
  )
}
