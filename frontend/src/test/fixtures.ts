import type { BodyMap, BodyMapMuscle, MuscleState, SearchResults, Status } from '../api/types'

const GROUPS = [
  'abdominals',
  'abductors',
  'adductors',
  'biceps',
  'calves',
  'chest',
  'forearms',
  'glutes',
  'hamstrings',
  'lats',
  'lower_back',
  'neck',
  'quadriceps',
  'shoulders',
  'traps',
  'triceps',
  'upper_back',
]

const STATES: Record<string, MuscleState> = {
  chest: 'progressing',
  biceps: 'progressing',
  quadriceps: 'not_progressing',
  hamstrings: 'declining',
  calves: 'no_status',
  forearms: 'indirect_only',
}

export function muscle(
  group: string,
  state: MuscleState = 'never_trained',
  stale = false,
): BodyMapMuscle {
  const label = group.replace('_', ' ').replace(/^./, (c) => c.toUpperCase())
  return {
    group,
    label,
    state,
    stale,
    last_trained: state === 'never_trained' ? null : '2026-09-29',
  }
}

export const bodyMap: BodyMap = {
  as_of: '2026-10-01',
  muscles: GROUPS.map((g) => muscle(g, STATES[g], g === 'biceps')),
}

export const status: Status = {
  has_data: true,
  synced_minutes_ago: 5,
  refreshing: false,
  refresh_failed: false,
}

export const recent: SearchResults = {
  exercises: [
    {
      id: 'ROW',
      title: 'Seated Cable Row',
      primary_muscle: 'upper_back',
      last_trained: '2026-09-29',
    },
    {
      id: 'CURL',
      title: 'Bicep Curl (Cable)',
      primary_muscle: 'biceps',
      last_trained: '2026-09-26',
    },
  ],
  muscles: [],
}
