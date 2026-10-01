import type { MuscleState } from '../api/types'

interface StateStyle {
  label: string
  symbol: string
  color: string // on the map, in the legend and in lists
}

/** How each muscle state looks and reads. Only the three progress statuses are
 * coloured on the map; the rest stay the figure's colour, as in Hevy. */
export const STATE_STYLES: Record<MuscleState, StateStyle> = {
  progressing: { label: 'Progressing', symbol: '▲', color: 'var(--progressing)' },
  not_progressing: { label: 'Not progressing', symbol: '●', color: 'var(--not-progressing)' },
  declining: { label: 'Declining', symbol: '▼', color: 'var(--declining)' },
  no_status: { label: 'Not enough data yet', symbol: '…', color: 'var(--map-figure)' },
  indirect_only: { label: 'Only trained indirectly', symbol: '–', color: 'var(--map-figure)' },
  never_trained: { label: 'Not trained', symbol: '', color: 'var(--map-figure)' },
}

/** States with a progress status: coloured on the map, and striped when stale. */
export const STATUS_STATES: MuscleState[] = ['progressing', 'not_progressing', 'declining']
