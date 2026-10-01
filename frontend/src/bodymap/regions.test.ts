import { describe, expect, it } from 'vitest'
import { BACK_MUSCLES, FRONT_MUSCLES } from 'body-muscles'
import { HEVY_REGIONS, REGIONS } from './regions'

// Must match BODY_MUSCLES in backend/api/responses.py.
const BODY_MUSCLES = [
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

describe('body map regions', () => {
  it('covers every Hevy body muscle', () => {
    expect(Object.keys(HEVY_REGIONS).sort()).toEqual(BODY_MUSCLES)
  })

  it.each(BODY_MUSCLES)('draws %s somewhere on the figure', (group) => {
    const regions = [...REGIONS.front, ...REGIONS.back].filter((r) => r.group === group)
    expect(regions.length).toBeGreaterThan(0)
  })

  it('gives each figure region to at most one muscle group', () => {
    for (const { id } of [...FRONT_MUSCLES, ...BACK_MUSCLES]) {
      const owners = Object.entries(HEVY_REGIONS).filter(([, prefixes]) =>
        prefixes.some((p) => id.startsWith(p)),
      )
      expect(owners.length, id).toBeLessThanOrEqual(1)
    }
  })

  it('separates lats from upper back, and traps from both', () => {
    const groupOf = (id: string) => REGIONS.back.find((r) => r.id === id)?.group
    expect(groupOf('lats-mid-left')).toBe('lats')
    expect(groupOf('traps-mid-left')).toBe('upper_back')
    expect(groupOf('traps-upper-left')).toBe('traps')
  })
})
