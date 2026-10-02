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

describe('ColumnLineChart gaps', () => {
  it('bridges columns with no value with a dashed stretch', () => {
    const { container } = render(
      <ColumnLineChart
        label="test"
        columns={[0, 1, 2, 3].map((i) => ({ key: String(i) }))}
        lines={[{ values: [1, 2, null, 4], variant: 'trend', bridgeGaps: true }]}
        dots={[]}
      />,
    )
    expect(container.querySelectorAll('polyline')).toHaveLength(1) // weeks 1-2, solid
    expect(container.querySelectorAll('line[class*="bridge"]')).toHaveLength(1) // 2 → 4, dashed
  })
})

describe('ColumnLineChart line entry', () => {
  const firstPoint = (from?: 'origin' | number) => {
    const { container } = render(
      <ColumnLineChart
        label="test"
        columns={[0, 1].map((i) => ({ key: String(i) }))}
        lines={[{ values: [10, 20], variant: 'target', from }]}
        dots={[]}
      />,
    )
    return container.querySelector('polyline')!.getAttribute('points')!.split(' ')[0]
  }

  it('starts at the first column by default', () => {
    expect(firstPoint()).toMatch(/^25,/)
  })

  it('can come in from the corner where the axes meet', () => {
    expect(firstPoint('origin')).toBe('0,100')
  })

  it('can come in at an earlier level, from history off the left of the chart', () => {
    const [x, y] = firstPoint(20).split(',').map(Number)
    expect(x).toBe(0)
    // Level with the second point (also 20), not the corner.
    expect(y).toBeLessThan(50)
  })
})

describe('ColumnLineChart scrolling', () => {
  const chart = (minColumnWidth?: number) =>
    render(
      <ColumnLineChart
        label="test"
        columns={[0, 1].map((i) => ({ key: String(i) }))}
        lines={[{ values: [1, 2], variant: 'trend' }]}
        dots={[]}
        minColumnWidth={minColumnWidth}
      />,
    ).container.querySelector('[class*="chart"]')!

  // A scroller would clip a callout above the plot (the muscle page's "+18.3%").
  it('only scrolls when given a minimum column width', () => {
    expect(chart()).not.toHaveAttribute('data-scroll')
    expect(chart(48)).toHaveAttribute('data-scroll')
  })
})
