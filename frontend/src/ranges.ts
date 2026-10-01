import type { RepRange } from './api/types'

/** Rep ranges in the terms lifters know (NSCA): hypertrophy and muscular endurance. */
export const RANGE_NAMES: Record<RepRange, string> = {
  strength: 'Hypertrophy',
  light: 'Endurance',
}

export const RANGE_REPS: Record<RepRange, string> = {
  strength: '≤12 reps',
  light: '13+ reps',
}
