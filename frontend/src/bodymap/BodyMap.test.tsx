import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BodyMap } from './BodyMap'
import { muscle } from '../test/fixtures'

function fillsOf(container: HTMLElement, label: RegExp): string[] {
  const groups = [...container.querySelectorAll('g[role="button"]')].filter((g) =>
    label.test(g.getAttribute('aria-label') ?? ''),
  )
  return groups.flatMap((g) =>
    [...g.querySelectorAll('path[fill]')].map((p) => p.getAttribute('fill') ?? ''),
  )
}

describe('BodyMap', () => {
  it('stripes stale muscles in their status colour', () => {
    const { container } = render(
      <BodyMap muscles={[muscle('chest', 'progressing', true)]} onSelect={vi.fn()} />,
    )
    const fills = fillsOf(container, /^Chest/)
    expect(fills.length).toBeGreaterThan(0)
    expect(new Set(fills)).toEqual(new Set(['url(#stale-progressing)']))
    expect(container.querySelector('#stale-progressing')).not.toBeNull()
  })

  it.each(['no_status', 'indirect_only', 'never_trained'] as const)(
    'leaves muscles without a progress status in the figure colour (%s)',
    (state) => {
      const { container } = render(
        <BodyMap muscles={[muscle('calves', state, true)]} onSelect={vi.fn()} />,
      )
      const fills = fillsOf(container, /^Calves/)
      expect(fills.length).toBeGreaterThan(0)
      expect(new Set(fills)).toEqual(new Set(['var(--map-figure)']))
    },
  )

  it('defines each stripe pattern once on the page', () => {
    const { container } = render(<BodyMap muscles={[]} onSelect={vi.fn()} />)
    expect(container.querySelectorAll('#stale-progressing')).toHaveLength(1)
  })
})

it('gives every muscle a tap area larger than its shape', () => {
  const { container } = render(
    <BodyMap muscles={[muscle('adductors', 'progressing')]} onSelect={vi.fn()} />,
  )
  const group = container.querySelector('g[aria-label^="Adductors"]')!
  const shapes = group.querySelectorAll('path[fill]').length
  expect(shapes).toBeGreaterThan(0)
  expect(group.querySelectorAll('path').length).toBe(shapes * 2) // each shape + its tap area
})
