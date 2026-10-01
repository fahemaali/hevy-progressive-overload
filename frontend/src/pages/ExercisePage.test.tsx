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
  it('leads with the estimated 1-rep max, its trend, and your personal best', async () => {
    setup()
    const summary = await screen.findByRole('region', { name: 'Summary' })
    expect(within(summary).getByText('Estimated 1-rep max')).toBeInTheDocument()
    expect(within(summary).getByText('36.4 kg')).toBeInTheDocument()
    expect(within(summary).getByText(/\+21\.3%/)).toHaveTextContent('vs recent sessions')
    expect(within(summary).getByText('Matches your personal best')).toBeInTheDocument()
  })

  it('names the personal best when the latest session is below it', async () => {
    const [strength, light] = rowExercise.ranges
    const older = { ...strength.sessions[1], date: '2026-09-01', score: 40 }
    setup({
      ...rowExercise,
      ranges: [{ ...strength, sessions: [older, ...strength.sessions] }, light],
    })
    const summary = await screen.findByRole('region', { name: 'Summary' })
    expect(within(summary).getByText('Personal best: 40 kg on 1 Sept')).toBeInTheDocument()
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

  it('switches between Hypertrophy and Endurance', async () => {
    setup()
    expect(await screen.findByRole('tab', { name: 'Hypertrophy' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    const endurance = screen.getByRole('tab', { name: 'Endurance' })
    await userEvent.click(endurance)
    expect(endurance).toHaveAttribute('aria-selected', 'true')
    const next = screen.getByRole('region', { name: 'Next session' })
    expect(within(next).getByText('9 kg × 20')).toBeInTheDocument()
    expect(within(next).getByText('Hit 20 · repeat to confirm')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Capacity' })).toBeNull()
  })

  it('charts past sessions and the next two planned ones, read out in plain English', async () => {
    setup()
    const sessions = await screen.findByRole('radiogroup', { name: 'Sessions' })
    const columns = within(sessions).getAllByRole('radio')
    expect(columns.map((c) => c.getAttribute('aria-label'))).toEqual([
      '15 Sept',
      '25 Sept',
      'Next session',
      'Then session',
    ])
    const progress = screen.getByRole('region', { name: 'Progress' })
    expect(within(progress).getByText(/You lifted/).parentElement).toHaveTextContent(
      '25 Sept · You lifted 29.5 kg × 7, 7Target was 22.5 kg × 11 · ✓ beaten',
    )

    columns[1].focus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(columns[0]).toHaveAttribute('aria-checked', 'true')
    expect(within(progress).getByText(/First session: your starting point/)).toBeInTheDocument()

    await userEvent.click(columns[2])
    expect(within(progress).getByText(/Aim for/).parentElement).toHaveTextContent(
      'Next session · Aim for 29.5 kg × 8Planned from your last session',
    )
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
