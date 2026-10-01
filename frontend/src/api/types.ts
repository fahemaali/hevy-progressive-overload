/**
 * The shapes the API returns. These mirror backend/api/responses.py: keep the two
 * in step when either changes.
 */

export type Trend = 'up' | 'flat' | 'down' | 'new' | 'insufficient'

export type MuscleState =
  'progressing' | 'not_progressing' | 'declining' | 'no_status' | 'indirect_only' | 'never_trained'

export interface BodyMapMuscle {
  group: string
  label: string
  state: MuscleState
  stale: boolean
  last_trained: string | null
}

export interface BodyMap {
  as_of: string
  muscles: BodyMapMuscle[]
}

export interface ExerciseHit {
  id: string
  title: string
  primary_muscle: string
  last_trained: string | null
}

export interface MuscleHit {
  group: string
  label: string
}

export interface SearchResults {
  exercises: ExerciseHit[]
  muscles: MuscleHit[]
}

export interface Status {
  has_data: boolean
  synced_minutes_ago: number | null
  refreshing: boolean
  refresh_failed: boolean
}

export type Role = 'primary' | 'secondary'
export type Mode = 'load' | 'reps' | 'assisted' | 'duration' | 'untracked'
export type RepRange = 'strength' | 'light'
export type PlanStep = 'building' | 'confirm' | 'add_weight' | 'stalled'

/** What was lifted: the working weight and the reps of every set at it. */
export interface WorkingSet {
  weight_kg: number | null
  reps: number[]
  duration_seconds: number | null
}

export interface MuscleWeek {
  week_start: string
  trend: Trend
  change_pct: number | null
  exercises: {
    id: string
    title: string
    role: Role
    trend: Trend
    date: string
    rep_range: RepRange | null
  }[]
}

export interface StrengthEntry {
  id: string
  title: string
  mode: Mode
  role: Role
  trend: Trend | null
  last_trained: string
  rep_range: RepRange | null
  latest: WorkingSet
  best: WorkingSet
  est_1rm_kg: number | null
}

export interface Muscle {
  group: string
  label: string
  state: MuscleState
  stale: boolean
  change_pct: number | null
  change_week: string | null
  weeks: MuscleWeek[]
  exercises: StrengthEntry[]
}

export interface Target {
  weight_kg: number | null
  reps: number | null
  duration_seconds: number | null
  sets: number
}

export interface Session {
  date: string
  did: WorkingSet
  score: number
  target: Target | null
  vs_target: -1 | 0 | 1 | null
  trend: Trend
  is_best: boolean
}

export interface Plan {
  step: PlanStep
  rep_target: [number, number] | null
  today: Target
  then: Target
  reps_to_go: number | null
  ahead_of_plan: boolean
}

export interface Capacity {
  weight_kg: number
  change_pct: number
  evidence: { id: string; title: string; change_pct: number }[]
}

export interface RangeProgress {
  rep_range: RepRange | null
  est_1rm_kg: number | null
  trend: Trend
  change_pct: number | null
  is_best: boolean
  off_best_pct: number | null
  sessions: Session[]
  plan: Plan
  capacity: Capacity | null
}

export interface Exercise {
  id: string
  title: string
  mode: Mode
  lower_is_better: boolean
  primary_muscle: string
  secondary_muscles: string[]
  default_range: RepRange | null
  ranges: RangeProgress[]
}
