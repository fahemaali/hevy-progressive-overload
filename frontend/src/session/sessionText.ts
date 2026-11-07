import { plural } from '../format'

/** "Last trained today", "Last trained 1 day ago", "Last trained 9 days ago". */
export function lastTrained(days: number): string {
  return days === 0 ? 'Last trained today' : `Last trained ${plural(days, 'day')} ago`
}

/** One fewer set on a low energy day, never below one. */
export function setsFor(sets: number, lowEnergy: boolean): number {
  return lowEnergy ? Math.max(1, sets - 1) : sets
}
