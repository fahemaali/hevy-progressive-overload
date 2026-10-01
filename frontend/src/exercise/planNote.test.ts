import { describe, expect, it } from 'vitest'
import type { Plan } from '../api/types'
import { planNote } from './planNote'

const target = { weight_kg: 50, reps: 9, duration_seconds: null, sets: 3 }

function plan(overrides: Partial<Plan>): Plan {
  return {
    step: 'building',
    rep_target: [8, 12],
    today: target,
    then: target,
    reps_to_go: 3,
    ahead_of_plan: false,
    ...overrides,
  }
}

describe('planNote', () => {
  it.each([
    [plan({ reps_to_go: 3 }), 'load', '3 reps to go before adding weight'],
    [plan({ reps_to_go: 1 }), 'load', '1 rep to go before adding weight'],
    [plan({ reps_to_go: 2 }), 'assisted', '2 reps to go before less assistance'],
    [plan({ step: 'confirm' }), 'load', 'Hit 12 · repeat to confirm'],
    [plan({ step: 'confirm', rep_target: [15, 20] }), 'load', 'Hit 20 · repeat to confirm'],
    [plan({ step: 'add_weight' }), 'load', 'Confirmed · add weight'],
    [plan({ step: 'add_weight' }), 'assisted', 'Confirmed · less assistance'],
    [plan({ step: 'stalled' }), 'load', 'Stalled 3 sessions · step back and rebuild'],
    [plan({ step: 'catch_up' }), 'load', 'Back on track with the plan'],
    [plan({ rep_target: null, reps_to_go: null }), 'reps', 'One more rep than last time'],
    [plan({ rep_target: null, reps_to_go: null }), 'duration', '5 seconds longer than last time'],
  ] as const)('%#: %s', (p, mode, expected) => {
    expect(planNote(p, mode)).toBe(expected)
  })
})
