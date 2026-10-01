import type { BodyMapMuscle } from './api/types'

/** Muscles trained directly (the ones with, or building towards, a status), A–Z. */
export function trackedMuscles(muscles: BodyMapMuscle[]): BodyMapMuscle[] {
  return muscles
    .filter((m) => m.state !== 'never_trained' && m.state !== 'indirect_only')
    .sort((a, b) => a.label.localeCompare(b.label))
}
