import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BodyMap } from './BodyMap'
import { muscle } from '../test/fixtures'

function fillsOf(container: HTMLElement, label: RegExp): string[] {
  const groups = [...container.querySelectorAll('g[role="button"]')].filter((g) =>
    label.test(g.getAttribute('aria-label') ?? ''),
  )
  return groups.flatMap((g) =>
    [...g.querySelectorAll('path')].map((p) => p.getAttribute('fill') ?? ''),
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

  it.each(['no_status', 'indirect_only'] as const)(
    'never stripes a stale muscle without a progress status (%s)',
    (state) => {
      const { container } = render(
        <BodyMap muscles={[muscle('calves', state, true)]} onSelect={vi.fn()} />,
      )
      const fills = fillsOf(container, /^Calves/)
      expect(fills.length).toBeGreaterThan(0)
      expect(fills.every((f) => f.startsWith('var('))).toBe(true)
    },
  )

  it('defines each stripe pattern once on the page', () => {
    const { container } = render(<BodyMap muscles={[]} onSelect={vi.fn()} />)
    expect(container.querySelectorAll('#stale-progressing')).toHaveLength(1)
  })
})
