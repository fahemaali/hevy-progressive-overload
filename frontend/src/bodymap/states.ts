import type { MuscleState } from '../api/types'

/** How each muscle state looks and reads, on the map, in the legend and in lists. */
export const STATE_STYLES: Record<MuscleState, { color: string; label: string; symbol: string }> = {
  progressing: { color: 'var(--progressing)', label: 'Progressing', symbol: '▲' },
  not_progressing: { color: 'var(--not-progressing)', label: 'Not progressing', symbol: '●' },
  declining: { color: 'var(--declining)', label: 'Declining', symbol: '▼' },
  no_status: { color: 'var(--map-no-status)', label: 'Not enough data yet', symbol: '…' },
  indirect_only: { color: 'var(--map-indirect)', label: 'Only trained indirectly', symbol: '–' },
  never_trained: { color: 'var(--map-never)', label: 'Not trained', symbol: '' },
}

/** States with a progress status, which can also be shown as stale. */
export const STATUS_STATES: MuscleState[] = ['progressing', 'not_progressing', 'declining']
