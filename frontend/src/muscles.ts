import type { BodyMapMuscle } from './api/types'

/** Muscles trained directly (the ones with, or building towards, a status), A–Z. */
export function trackedMuscles(muscles: BodyMapMuscle[]): BodyMapMuscle[] {
  return muscles
    .filter((m) => m.state !== 'never_trained' && m.state !== 'indirect_only')
    .sort((a, b) => a.label.localeCompare(b.label))
}

/** "lower_back" → "Lower back" */
export function muscleLabel(group: string): string {
  const text = group.replaceAll('_', ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}
