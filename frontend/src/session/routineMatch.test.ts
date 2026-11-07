import { describe, expect, it } from 'vitest'
import { closestRoutine } from './routineMatch'

const ex = (id: string) => ({ id, title: `Exercise ${id}` })
const routine = (title: string, ...ids: string[]) => ({ title, exercises: ids.map(ex) })

describe('closestRoutine', () => {
  it('names the routine to duplicate, with what to add and remove', () => {
    const match = closestRoutine(
      [ex('A'), ex('B'), ex('C'), ex('X')],
      [routine('Day 1 a', 'A', 'B', 'C', 'Y'), routine('Day 2 b', 'P', 'Q')],
    )
    expect(match).toEqual({ title: 'Day 1 a', add: ['Exercise X'], remove: ['Exercise Y'] })
  })

  it('picks the closest of several', () => {
    const chosen = [ex('A'), ex('B'), ex('C')]
    const match = closestRoutine(chosen, [
      routine('Day 3 a', 'A', 'Y', 'Z'),
      routine('Day 1 a', 'A', 'B', 'C'),
    ])
    expect(match).toEqual({ title: 'Day 1 a', add: [], remove: [] })
  })

  it('says nothing when every routine is more than two swaps away', () => {
    const chosen = [ex('A'), ex('B'), ex('C'), ex('D')]
    expect(closestRoutine(chosen, [routine('Day 1 a', 'A', 'X', 'Y', 'Z')])).toBeNull()
    expect(closestRoutine(chosen, [])).toBeNull()
  })
})
