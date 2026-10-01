import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ColumnLineChart } from './ColumnLineChart'

function axisLabels(values: number[]): number[] {
  const { container } = render(
    <ColumnLineChart
      label="test"
      columns={values.map((_, i) => ({ key: String(i) }))}
      lines={[{ values, variant: 'actual' }]}
      dots={[]}
      yAxis={{ format: (v) => String(v) }}
    />,
  )
  return [...container.querySelectorAll('[class*="tick"]')].map((t) => Number(t.textContent))
}

describe('ColumnLineChart y-axis', () => {
  it('uses round tick values that cover the data', () => {
    const ticks = axisLabels([19, 36.4, 40])
    expect(ticks.every((t) => t % 5 === 0)).toBe(true)
    expect(Math.min(...ticks)).toBeLessThanOrEqual(19)
    expect(Math.max(...ticks)).toBeGreaterThanOrEqual(40)
  })

  it('does not zoom in so far that tiny differences look big', () => {
    // 31.5 vs 31.7 kg: the axis should span several kg, not 0.2.
    const ticks = axisLabels([31.5, 31.5, 31.67])
    expect(Math.max(...ticks) - Math.min(...ticks)).toBeGreaterThanOrEqual(6)
  })
})
