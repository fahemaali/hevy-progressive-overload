import { ApiError } from '../api/client'
import styles from './Feedback.module.css'

export function Loading({ label }: { label: string }) {
  return (
    <div className={styles.loading} role="status" aria-label={label}>
      <span className={styles.spinner} />
    </div>
  )
}

export function ErrorMessage({ error }: { error: Error }) {
  const message =
    error instanceof ApiError
      ? error.message
      : "Couldn't connect. Check your connection and try again."
  return (
    <div className={styles.error} role="alert">
      {message}
    </div>
  )
}
