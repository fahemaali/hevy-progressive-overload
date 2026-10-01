import type { Mode, Plan, Target } from '../api/types'
import { kg, plural } from '../format'

/**
 * One goal-focused sentence for a session card, telling where its target sits in
 * the double-progression story:
 *
 *   build from the bottom of the range to the top, one rep at a time → hit the top
 *   → repeat it once → unlock the next weight → start again at the bottom.
 *
 * "This session" reads the plan's step; "Next session" reads one step further on.
 */
export function goalSentence(card: 'this' | 'next', plan: Plan, mode: Mode): string {
  if (mode === 'reps') {
    return `Beat your best: ${plural(target(card, plan).reps ?? 0, 'rep')}`
  }
  if (mode === 'duration') return '5 more seconds than last time'

  const top = plan.rep_target?.[1] ?? 12
  const unlock = mode === 'assisted' ? 'less assistance' : 'the next weight'

  if (card === 'this') {
    switch (plan.step) {
      case 'add_weight':
        return newWeight(mode, top)
      case 'stalled':
        return `Stalled. Let's start fresh at ${kg(plan.today.weight_kg ?? 0)} kg and rebuild to ${top}`
      case 'confirm':
        return `Repeat ${top} to unlock ${unlock}`
      case 'catch_up':
        return `To get back on track: ${lowercaseFirst(climb(plan.today, top, unlock))}`
      default:
        return climb(plan.today, top, unlock)
    }
  }

  // Next session: one step on from this session's target (assuming it's hit).
  const { today, then } = plan
  if (isHarder(then, today, mode)) return newWeight(mode, top)
  if ((then.reps ?? 0) === top && (today.reps ?? 0) === top)
    return `Repeat ${top} to unlock ${unlock}`
  return climb(then, top, unlock)
}

/** Where a target sits on the climb to the top of the range. */
function climb(t: Target, top: number, unlock: string): string {
  const reps = t.reps ?? 0
  if (reps === top) return `Hit ${top}, then repeat it to unlock ${unlock}`
  if (reps > top) return 'One more rep than last time' // e.g. already unassisted
  const toGo = top - reps
  return toGo === 1 ? `One more rep to hit ${top}` : `${toGo} more reps to hit ${top}`
}

function newWeight(mode: Mode, top: number): string {
  return mode === 'assisted'
    ? `Less assistance unlocked! Build back up to ${top}`
    : `New weight unlocked! Build back up to ${top}`
}

/** Heavier weight (less assistance, for assisted exercises) than `b`. */
function isHarder(a: Target, b: Target, mode: Mode): boolean {
  const aw = a.weight_kg ?? 0
  const bw = b.weight_kg ?? 0
  return mode === 'assisted' ? aw < bw : aw > bw
}

function target(card: 'this' | 'next', plan: Plan): Target {
  return card === 'this' ? plan.today : plan.then
}

function lowercaseFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1)
}
