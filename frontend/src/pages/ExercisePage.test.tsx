import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockApi, renderApp } from '../test/render'
import { rowExercise, status } from '../test/fixtures'

afterEach(() => vi.unstubAllGlobals())

function setup(exercise: unknown = rowExercise) {
  mockApi({ '/api/exercises/ROW': exercise, '/api/status': status })
  return renderApp('/exercises/ROW')
}

describe('exercise page', () => {
  it('leads with est. 1RM, trend and distance from best', async () => {
    setup()
    const summary = await screen.findByRole('region', { name: 'Summary' })
    expect(within(summary).getByText('36.4 kg')).toBeInTheDocument()
    expect(within(summary).getByText(/\+21\.3%/)).toBeInTheDocument()
    expect(within(summary).getByText('−9% from best')).toBeInTheDocument()
  })

  it('puts the chart above the plan, as designed', async () => {
    setup()
    await screen.findByRole('region', { name: 'Progress' })
    const titles = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(titles.indexOf('Progress')).toBeLessThan(titles.indexOf('Next session'))
  })

  it('gives today and then targets with a one-line reason', async () => {
    setup()
    const next = await screen.findByRole('region', { name: 'Next session' })
    expect(within(next).getByText('29.5 kg × 8')).toBeInTheDocument()
    expect(within(next).getByText('2 sets')).toBeInTheDocument()
    expect(within(next).getByText('29.5 kg × 9')).toBeInTheDocument()
    expect(within(next).getByText('5 reps to go before adding weight')).toBeInTheDocument()
    expect(within(next).getByText('Ahead of plan')).toBeInTheDocument()
  })

  it('shows capacity evidence from other exercises', async () => {
    setup()
    const capacity = await screen.findByRole('region', { name: 'Capacity' })
    expect(capacity).toHaveTextContent('Try 34.5 kg')
    expect(capacity).toHaveTextContent('Lat Pulldown +18%')
  })

  it('switches between Strength and Light', async () => {
    setup()
    const light = await screen.findByRole('tab', { name: 'Light' })
    await userEvent.click(light)
    expect(light).toHaveAttribute('aria-selected', 'true')
    const next = screen.getByRole('region', { name: 'Next session' })
    expect(within(next).getByText('9 kg × 20')).toBeInTheDocument()
    expect(within(next).getByText('Hit 20 · repeat to confirm')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Capacity' })).toBeNull()
  })

  it('reads out the session picked on the chart, by keyboard too', async () => {
    setup()
    const chart = await screen.findByRole('slider', { name: 'Sessions' })
    const progress = screen.getByRole('region', { name: 'Progress' })
    expect(within(progress).getByText('29.5 kg × 7, 7')).toBeInTheDocument()
    expect(within(progress).getByText(/Beat it/)).toBeInTheDocument()

    chart.focus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(chart).toHaveAttribute('aria-valuenow', '1')
    expect(within(progress).getByText('22.5 kg × 10, 10')).toBeInTheDocument()
    expect(within(progress).getByText('First session')).toBeInTheDocument()
  })

  it('has a table of every session, newest first', async () => {
    setup()
    await userEvent.click(await screen.findByText('All sessions (2)'))
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(rows.map((r) => within(r).getAllByRole('cell')[0].textContent)).toEqual([
      '25 Sept',
      '15 Sept',
    ])
  })

  it('has no range toggle when there is only one range', async () => {
    setup({ ...rowExercise, ranges: [rowExercise.ranges[0]] })
    await screen.findByRole('region', { name: 'Summary' })
    expect(screen.queryByRole('tablist')).toBeNull()
  })
})
