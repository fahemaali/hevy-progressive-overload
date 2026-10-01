import { Link, useLocation, useNavigate } from 'react-router'
import styles from './BackLink.module.css'

/** Goes back where you came from; opened directly (e.g. a shared link), goes to `fallback`. */
export function BackLink({ fallback, label }: { fallback: string; label: string }) {
  const navigate = useNavigate()
  const location = useLocation()
  const hasHistory = location.key !== 'default'
  return (
    <Link
      to={fallback}
      className={styles.back}
      onClick={(e) => {
        if (hasHistory) {
          e.preventDefault()
          void navigate(-1)
        }
      }}
    >
      ← {label}
    </Link>
  )
}
