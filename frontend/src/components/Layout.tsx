import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, Outlet } from 'react-router'
import { useStatus } from '../api/client'
import { APP_NAME } from '../config'
import { formatMinutes } from '../format'
import styles from './Layout.module.css'

export function Layout() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/" className={styles.name}>
          {APP_NAME}
        </Link>
        <div className={styles.right}>
          <SyncStatus />
          <Link to="/about" className={styles.about} aria-label="About">
            ⓘ
          </Link>
        </div>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}

/** How fresh the data is. When a background refresh finishes, reloads everything. */
function SyncStatus() {
  const { data } = useStatus()
  const queryClient = useQueryClient()
  const wasRefreshing = useRef(false)

  useEffect(() => {
    if (wasRefreshing.current && data && !data.refreshing) {
      void queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'status' })
    }
    wasRefreshing.current = data?.refreshing ?? false
  }, [data, queryClient])

  if (!data?.has_data) return null
  let text: string
  if (data.refreshing) text = 'Updating…'
  else if (data.refresh_failed) text = "Couldn't reach Hevy"
  else if (data.synced_minutes_ago === 0) text = 'Up to date'
  else text = `Updated ${formatMinutes(data.synced_minutes_ago ?? 0)} ago`

  return (
    <span className={styles.status} data-warning={data.refresh_failed || undefined} role="status">
      {text}
    </span>
  )
}
