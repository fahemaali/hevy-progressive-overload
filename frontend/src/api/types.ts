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
