import { describe, expect, it } from 'vitest'
import type { Mode, Plan, PlanStep, Target } from '../api/types'
import { goalSentence } from './goal'

const t = (weight_kg: number | null, reps: number | null, duration_seconds: number | null = null) =>
  ({ weight_kg, reps, duration_seconds, sets: 3 }) as Target

function plan(step: PlanStep, today: Target, then: Target, top = 12): Plan {
  return {
    step,
    rep_target: [top === 12 ? 8 : 15, top],
    today,
    then,
    reps_to_go: null,
    ahead_of_plan: false,
  }
}

const cases: [string, Plan, Mode, string, string][] = [
  // [scenario, plan, mode, this card, next card]
  [
    '8 reps',
    plan('building', t(18, 8), t(18, 9)),
    'load',
    '4 more reps to hit 12',
    '3 more reps to hit 12',
  ],
  [
    '10 reps',
    plan('building', t(18, 10), t(18, 11)),
    'load',
    '2 more reps to hit 12',
    'One more rep to hit 12',
  ],
  [
    '11 reps',
    plan('building', t(18, 11), t(18, 12)),
    'load',
    'One more rep to hit 12',
    'Hit 12, then repeat it to unlock the next weight',
  ],
  [
    '12, first time',
    plan('building', t(18, 12), t(18, 12)),
    'load',
    'Hit 12, then repeat it to unlock the next weight',
    'Repeat 12 to unlock the next weight',
  ],
  [
    '12, the repeat',
    plan('confirm', t(18, 12), t(23, 8)),
    'load',
    'Repeat 12 to unlock the next weight',
    'New weight unlocked! Build back up to 12',
  ],
  [
    'new weight',
    plan('add_weight', t(23, 8), t(23, 9)),
    'load',
    'New weight unlocked! Build back up to 12',
    '3 more reps to hit 12',
  ],
  [
    'fell short',
    plan('catch_up', t(45, 9), t(45, 10)),
    'load',
    'To get back on track: 3 more reps to hit 12',
    '2 more reps to hit 12',
  ],
  [
    'stalled',
    plan('stalled', t(55, 8), t(55, 9)),
    'load',
    "Stalled. Let's start fresh at 55 kg and rebuild to 12",
    '3 more reps to hit 12',
  ],
  [
    'endurance',
    plan('building', t(20, 19), t(20, 20), 20),
    'load',
    'One more rep to hit 20',
    'Hit 20, then repeat it to unlock the next weight',
  ],
  [
    'assisted repeat',
    plan('confirm', t(25, 12), t(20, 8)),
    'assisted',
    'Repeat 12 to unlock less assistance',
    'Less assistance unlocked! Build back up to 12',
  ],
  [
    'bodyweight',
    plan('building', t(null, 14), t(null, 15)),
    'reps',
    'Beat your best: 14 reps',
    'Beat your best: 15 reps',
  ],
  [
    'timed hold',
    plan('building', t(null, null, 70), t(null, null, 75)),
    'duration',
    '5 more seconds than last time',
    '5 more seconds than last time',
  ],
]

describe('goalSentence', () => {
  it.each(cases)('%s', (_, p, mode, thisCard, nextCard) => {
    expect(goalSentence('this', p, mode)).toBe(thisCard)
    expect(goalSentence('next', p, mode)).toBe(nextCard)
  })
})
