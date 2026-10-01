import { useQuery } from '@tanstack/react-query'
import type { BodyMap, Exercise, Muscle, SearchResults, Status } from './types'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { headers: { Accept: 'application/json' } })
  if (!response.ok) {
    // The API always answers errors with {"error": "..."}; fall back if it couldn't.
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new ApiError(response.status, body?.error ?? 'Something went wrong.')
  }
  return (await response.json()) as T
}

export function useBodyMap() {
  return useQuery({ queryKey: ['body-map'], queryFn: () => getJson<BodyMap>('/api/body-map') })
}

export function useMuscle(group: string) {
  return useQuery({
    queryKey: ['muscle', group],
    queryFn: () => getJson<Muscle>(`/api/muscles/${encodeURIComponent(group)}`),
  })
}

export function useExercise(id: string) {
  return useQuery({
    queryKey: ['exercise', id],
    queryFn: () => getJson<Exercise>(`/api/exercises/${encodeURIComponent(id)}`),
  })
}

export function useSearch(query: string, enabled: boolean) {
  return useQuery({
    queryKey: ['search', query],
    queryFn: () => getJson<SearchResults>(`/api/search?q=${encodeURIComponent(query)}`),
    enabled,
    placeholderData: (previous) => previous, // keep showing results while typing
  })
}

export function useStatus() {
  return useQuery({
    queryKey: ['status'],
    queryFn: () => getJson<Status>('/api/status'),
    refetchInterval: (query) => (query.state.data?.refreshing ? 3_000 : 60_000),
  })
}
