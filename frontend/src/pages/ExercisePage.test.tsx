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

function cards() {
  return within(screen.getByRole('region', { name: 'Sessions' })).getAllByRole('article')
}

function card(name: string) {
  return within(screen.getByRole('region', { name: 'Sessions' })).getByRole('article', { name })
}

function frontCard() {
  return cards().find((c) => c.getAttribute('aria-current') === 'true')!
}

describe('exercise page', () => {
  it('shows the change under the title, like the muscle page', async () => {
    setup()
    const heading = await screen.findByRole('heading', { level: 1, name: 'Seated Cable Row' })
    expect(heading.nextElementSibling).toHaveTextContent('+21.3% · last session, 25 Sept')
  })

  it('opens on the progress graph, with est. 1RM in its corner and a kg axis', async () => {
    setup()
    const progress = await screen.findByRole('region', { name: 'Progress' })
    expect(within(progress).getByText('Est. 1RM').parentElement).toHaveTextContent('36.4 kg')
    expect(within(progress).getByRole('figure')).toHaveAccessibleName(
      'Estimated 1-rep max (kg) by session',
    )
    expect(within(progress).getAllByText(/^\d+ kg$/).length).toBeGreaterThanOrEqual(3) // axis
    const main = screen.getByRole('main')
    const titles = within(main)
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent)
    expect(titles[0]).toBe('Progress')
  })

  it('charts past sessions plus this session and the next', async () => {
    setup()
    const progress = await screen.findByRole('region', { name: 'Progress' })
    const labels = within(progress).getAllByText(/^(15|25|This|Next)$/)
    expect(labels.map((l) => l.textContent)).toEqual(['15', '25', 'This', 'Next'])
  })

  it('shows last, this and next session side by side, this one in front', async () => {
    setup()
    await screen.findByRole('region', { name: 'Sessions' })
    expect(cards().map((c) => c.getAttribute('aria-label'))).toEqual([
      'Last session',
      'This session',
      'Next session',
    ])
    expect(frontCard()).toHaveAccessibleName('This session')
    expect(card('This session')).toHaveTextContent('29.5 kg × 8')
    expect(card('This session')).toHaveTextContent('2 sets · 5 reps to go before adding weight')
    expect(card('This session')).toHaveTextContent('Ahead of plan')
    expect(card('Last session')).toHaveTextContent('25 Sept29.5 kg × 7, 7')
    expect(card('Last session')).toHaveTextContent('Target was 22.5 kg × 11 · ✓ beaten')
    expect(card('Next session')).toHaveTextContent("29.5 kg × 9If you hit this session's target")
  })

  it('brings a card to the front when tapped or chosen with the keyboard', async () => {
    setup()
    await userEvent.click(await screen.findByRole('article', { name: 'Last session' }))
    expect(frontCard()).toHaveAccessibleName('Last session')
    card('Next session').focus()
    await userEvent.keyboard('{Enter}')
    expect(frontCard()).toHaveAccessibleName('Next session')
  })

  it('says when the last session was the first one', async () => {
    const [strength, light] = rowExercise.ranges
    setup({ ...rowExercise, ranges: [{ ...strength, sessions: [strength.sessions[0]] }, light] })
    expect(await screen.findByRole('article', { name: 'Last session' })).toHaveTextContent(
      'First session: your starting point',
    )
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
    expect(card('This session')).toHaveTextContent('9 kg × 20')
    expect(card('This session')).toHaveTextContent('Hit 20 · repeat to confirm')
    expect(screen.queryByRole('region', { name: 'Capacity' })).toBeNull()
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
    await screen.findByRole('region', { name: 'Progress' })
    expect(screen.queryByRole('tab', { name: 'Hypertrophy' })).toBeNull()
  })
})
