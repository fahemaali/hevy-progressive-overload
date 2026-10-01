import type {
  BodyMap,
  BodyMapMuscle,
  Exercise,
  Muscle,
  MuscleState,
  SearchResults,
  Status,
} from '../api/types'

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

const set = (weight_kg: number | null, ...reps: number[]) => ({
  weight_kg,
  reps,
  duration_seconds: null,
})

export const bicepsMuscle: Muscle = {
  group: 'biceps',
  label: 'Biceps',
  state: 'progressing',
  stale: false,
  weeks: [
    {
      week_start: '2026-09-07',
      trend: 'down',
      exercises: [
        {
          id: 'PULL',
          title: 'Lat Pulldown',
          role: 'secondary',
          trend: 'down',
          date: '2026-09-09',
          rep_range: 'strength',
        },
      ],
    },
    {
      week_start: '2026-09-21',
      trend: 'up',
      exercises: [
        // Oldest first, as the API sends them.
        {
          id: 'ROW',
          title: 'Seated Cable Row',
          role: 'secondary',
          trend: 'up',
          date: '2026-09-25',
          rep_range: 'strength',
        },
        {
          id: 'CURL',
          title: 'Bicep Curl (Cable)',
          role: 'primary',
          trend: 'up',
          date: '2026-09-26',
          rep_range: 'strength',
        },
        {
          id: 'CURL',
          title: 'Bicep Curl (Cable)',
          role: 'primary',
          trend: 'new',
          date: '2026-09-26',
          rep_range: 'light',
        },
      ],
    },
    { week_start: '2026-09-28', trend: 'insufficient', exercises: [] },
  ],
  exercises: [
    {
      id: 'CURL',
      title: 'Bicep Curl (Cable)',
      mode: 'load',
      role: 'primary',
      trend: 'up',
      last_trained: '2026-09-26',
      rep_range: 'strength',
      latest: set(9.1, 10, 10, 10),
      best: set(9.1, 10, 10, 10),
      est_1rm_kg: 12.1,
    },
    {
      id: 'ROW',
      title: 'Seated Cable Row',
      mode: 'load',
      role: 'secondary',
      trend: 'up',
      last_trained: '2026-09-25',
      rep_range: 'strength',
      latest: set(29.5, 7, 7),
      best: set(34, 5),
      est_1rm_kg: 36.4,
    },
  ],
}

const target = (weight_kg: number, reps: number, sets = 2) => ({
  weight_kg,
  reps,
  duration_seconds: null,
  sets,
})

export const rowExercise: Exercise = {
  id: 'ROW',
  title: 'Seated Cable Row',
  mode: 'load',
  lower_is_better: false,
  primary_muscle: 'upper_back',
  secondary_muscles: ['biceps', 'lats'],
  default_range: 'strength',
  ranges: [
    {
      rep_range: 'strength',
      est_1rm_kg: 36.4,
      trend: 'up',
      change_pct: 21.3,
      is_best: false,
      off_best_pct: 9.0,
      sessions: [
        {
          date: '2026-09-15',
          did: set(22.5, 10, 10),
          score: 30,
          target: null,
          target_score: null,
          vs_target: null,
          trend: 'new',
          is_best: false,
        },
        {
          date: '2026-09-25',
          did: set(29.5, 7, 7),
          score: 36.4,
          target: target(22.5, 11),
          target_score: 30.75,
          vs_target: 1,
          trend: 'up',
          is_best: true,
        },
      ],
      plan: {
        step: 'building',
        rep_target: [8, 12],
        today: target(29.5, 8),
        then: target(29.5, 9),
        reps_to_go: 5,
        ahead_of_plan: true,
      },
      capacity: {
        weight_kg: 34.5,
        change_pct: 18,
        evidence: [{ id: 'PULL', title: 'Lat Pulldown', change_pct: 18 }],
      },
    },
    {
      rep_range: 'light',
      est_1rm_kg: 16.2,
      trend: 'down',
      change_pct: -21.7,
      is_best: false,
      off_best_pct: 21.7,
      sessions: [
        {
          date: '2026-09-13',
          did: set(9, 24, 24),
          score: 16.2,
          target: null,
          target_score: null,
          vs_target: null,
          trend: 'new',
          is_best: false,
        },
      ],
      plan: {
        step: 'confirm',
        rep_target: [15, 20],
        today: target(9, 20),
        then: target(14, 15),
        reps_to_go: null,
        ahead_of_plan: false,
      },
      capacity: null,
    },
  ],
}
