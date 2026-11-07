import type { SessionRoutine } from '../api/types'

/** A routine the session is close to: what to add to and remove from a copy of it. */
export interface RoutineMatch {
  title: string
  add: string[]
  remove: string[]
}

// A routine is "close" when copying it takes at most this many swaps.
export const MAX_CHANGES = 2

/**
 * The saved routine the chosen exercises most resemble, so it can be duplicated in
 * Hevy and adjusted, or null if none is close. Ties go to the routine listed first.
 */
export function closestRoutine(
  chosen: { id: string; title: string }[],
  routines: SessionRoutine[],
): RoutineMatch | null {
  const chosenIds = new Set(chosen.map((e) => e.id))
  let best: (RoutineMatch & { changes: number }) | null = null
  for (const routine of routines) {
    const routineIds = new Set(routine.exercises.map((e) => e.id))
    const add = chosen.filter((e) => !routineIds.has(e.id)).map((e) => e.title)
    const remove = routine.exercises.filter((e) => !chosenIds.has(e.id)).map((e) => e.title)
    // Swapping one exercise for another counts once.
    const changes = Math.max(add.length, remove.length)
    if (changes <= MAX_CHANGES && (best === null || changes < best.changes)) {
      best = { title: routine.title, add, remove, changes }
    }
  }
  return best && { title: best.title, add: best.add, remove: best.remove }
}
