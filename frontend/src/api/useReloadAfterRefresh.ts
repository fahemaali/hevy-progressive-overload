import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useStatus } from './client'

/**
 * The server refreshes from Hevy in the background. When a refresh finishes,
 * reload everything on screen so it shows the new data. (Nothing is displayed.)
 */
export function useReloadAfterRefresh() {
  const { data } = useStatus()
  const queryClient = useQueryClient()
  const wasRefreshing = useRef(false)

  useEffect(() => {
    if (wasRefreshing.current && data && !data.refreshing) {
      void queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'status' })
    }
    wasRefreshing.current = data?.refreshing ?? false
  }, [data, queryClient])
}
