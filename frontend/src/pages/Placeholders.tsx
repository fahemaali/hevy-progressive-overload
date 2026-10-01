import { Link } from 'react-router'
import styles from './Placeholders.module.css'

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
