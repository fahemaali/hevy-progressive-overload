import { describe, expect, it } from 'vitest'
import { formatSet, formatTarget, kg, pct, shortDate, timeAgo } from './format'

describe('format', () => {
  it.each([
    [52.5, '52.5'],
    [50, '50'],
    [9.1, '9.1'],
  ])('kg(%s)', (value, expected) => expect(kg(value)).toBe(expected))

  it.each([
    [4.1, '+4.1%'],
    [-2.5, '−2.5%'],
    [0, '0%'],
    [10, '+10%'],
  ])('pct(%s)', (value, expected) => expect(pct(value)).toBe(expected))

  it('writes dates briefly, without timezone surprises', () => {
    expect(shortDate('2026-09-29')).toBe('29 Sept')
  })

  it('writes sets and targets per exercise type', () => {
    const set = { weight_kg: 29.5, reps: [7, 7], duration_seconds: null }
    expect(formatSet(set, 'load')).toBe('29.5 kg × 7, 7')
    expect(formatSet(set, 'assisted')).toBe('29.5 kg assist × 7, 7')
    expect(formatSet({ weight_kg: null, reps: [12, 10], duration_seconds: null }, 'reps')).toBe(
      '12, 10 reps',
    )
    expect(formatSet({ weight_kg: null, reps: [], duration_seconds: 60 }, 'duration')).toBe('60 s')
    expect(
      formatTarget(
        { weight_kg: 29.5, reps: 8, duration_seconds: null, sets: 2, score: 37.37 },
        'load',
      ),
    ).toBe('29.5 kg × 8')
  })
})

describe('timeAgo', () => {
  it('rounds down to the largest whole unit', () => {
    expect([0, 1, 5, 59, 60, 179, 1439, 1440, 4000].map(timeAgo)).toEqual([
      'just now',
      '1 minute ago',
      '5 minutes ago',
      '59 minutes ago',
      '1 hour ago',
      '2 hours ago',
      '23 hours ago',
      '1 day ago',
      '2 days ago',
    ])
  })
})
