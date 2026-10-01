import type { Mode, Plan } from '../api/types'
import { plural } from '../format'

/** One short line under Today / Then saying why: readable in two seconds mid-workout. */
export function planNote(plan: Plan, mode: Mode): string {
  const harder = mode === 'assisted' ? 'less assistance' : 'adding weight'
  const top = plan.rep_target?.[1]

  switch (plan.step) {
    case 'confirm':
      return `Hit ${top} · repeat to confirm`
    case 'add_weight':
      return mode === 'assisted' ? 'Confirmed · less assistance' : 'Confirmed · add weight'
    case 'stalled':
      return 'Stalled 3 sessions · step back and rebuild'
    case 'building':
      if (mode === 'reps') return 'One more rep than last time'
      if (mode === 'duration') return '5 seconds longer than last time'
      if (plan.reps_to_go && plan.reps_to_go > 0) {
        return `${plural(plan.reps_to_go, 'rep')} to go before ${harder}`
      }
      return 'One more rep on every set'
  }
}
