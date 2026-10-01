import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useStatus } from '../api/client'
import { formatMinutes } from '../format'
import styles from './SyncStatus.module.css'

/** How fresh the data is. When a background refresh finishes, reloads everything. */
export function SyncStatus() {
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
  if (data.refreshing) text = 'Updating from Hevy…'
  else if (data.refresh_failed) text = "Couldn't reach Hevy"
  else if (data.synced_minutes_ago === 0) text = 'Up to date with Hevy'
  else text = `Updated ${formatMinutes(data.synced_minutes_ago ?? 0)} ago`

  return (
    <span className={styles.status} data-warning={data.refresh_failed || undefined} role="status">
      <span className={styles.dot} />
      {text}
    </span>
  )
}
