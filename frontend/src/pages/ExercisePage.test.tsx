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

function slides() {
  return screen.getAllByRole('article', { hidden: true })
}

function activeSlide() {
  return slides().find((s) => s.getAttribute('aria-hidden') === 'false')!
}

describe('exercise page', () => {
  it('shows the change under the title, without a date', async () => {
    setup()
    const heading = await screen.findByRole('heading', { level: 1, name: 'Seated Cable Row' })
    expect(heading.nextElementSibling).toHaveTextContent(/^.*\+21\.3%$/) // no date beside it
  })

  it('opens on a graph of the weight lifted, with est. 1RM in its corner', async () => {
    setup()
    const progress = await screen.findByRole('region', { name: 'Progress' })
    expect(within(progress).getByText('Est. 1RM').parentElement).toHaveTextContent('36.4 kg')
    expect(within(progress).getByRole('figure')).toHaveAccessibleName(
      'Heaviest weight lifted (kg) by session',
    )
    expect(within(progress).queryByText('Heaviest weight lifted (kg)')).toBeNull() // no axis title
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

  it('shows every recent session as a card, then this and next, opening on this one', async () => {
    setup()
    await screen.findByRole('region', { name: 'Sessions' })
    expect(slides().map((s) => s.getAttribute('aria-label'))).toEqual([
      'Session on 15 Sept, 1 of 4',
      'Last session, 2 of 4',
      'This session, 3 of 4',
      'Next session, 4 of 4',
    ])
    expect(activeSlide()).toHaveTextContent('29.5 kg × 8')
    expect(activeSlide()).toHaveTextContent('2 sets · 4 more reps to hit 12')
    expect(activeSlide()).toHaveTextContent('Ahead of plan')
  })

  it('moves through the deck with the arrows and dots', async () => {
    setup()
    await userEvent.click(await screen.findByRole('button', { name: 'Previous session' }))
    expect(activeSlide()).toHaveAccessibleName('Last session, 2 of 4')
    expect(activeSlide()).toHaveTextContent('29.5 kg × 7, 7')
    expect(activeSlide()).toHaveTextContent('Target was 22.5 kg × 11 · ✓ beaten')

    await userEvent.click(screen.getByRole('button', { name: 'Previous session' }))
    expect(activeSlide()).toHaveTextContent('15 Sept22.5 kg × 10, 10')
    expect(screen.getByRole('button', { name: 'Previous session' })).toBeDisabled()

    await userEvent.click(screen.getByRole('tab', { name: 'Next session' }))
    expect(activeSlide()).toHaveTextContent('29.5 kg × 9')
    expect(activeSlide()).toHaveTextContent('3 more reps to hit 12')
  })

  it('shows the last 3 months of sessions, in the cards and the graph alike', async () => {
    const [strength, light] = rowExercise.ranges
    const old = { ...strength.sessions[0], date: '2026-05-01' } // well over 12 weeks earlier
    setup({
      ...rowExercise,
      ranges: [{ ...strength, sessions: [old, ...strength.sessions] }, light],
    })
    await screen.findByRole('region', { name: 'Sessions' })
    expect(slides()).toHaveLength(4) // 15 Sept, 25 Sept, this, next
    const progress = screen.getByRole('region', { name: 'Progress' })
    expect(within(progress).queryByText('May')).toBeNull()
  })

  it('swaps the dots for a counter when there are many sessions', async () => {
    const [strength, light] = rowExercise.ranges
    const many = Array.from({ length: 8 }, (_, i) => ({
      ...strength.sessions[1],
      date: `2026-09-${String(i + 10).padStart(2, '0')}`,
    }))
    setup({ ...rowExercise, ranges: [{ ...strength, sessions: many }, light] })
    expect(await screen.findByText('9 / 10')).toBeInTheDocument()
    expect(screen.queryByRole('tablist', { name: 'Choose a session' })).toBeNull()
  })

  it('says when the last session was the first one', async () => {
    const [strength, light] = rowExercise.ranges
    setup({ ...rowExercise, ranges: [{ ...strength, sessions: [strength.sessions[0]] }, light] })
    await userEvent.click(await screen.findByRole('button', { name: 'Previous session' }))
    expect(activeSlide()).toHaveTextContent('First session: your starting point')
  })

  it('gives a tip when other exercises for the muscle show more capacity', async () => {
    setup()
    const tip = await screen.findByRole('region', { name: 'Tip!' })
    expect(tip).toHaveTextContent(
      'Try 34.5 kg. Your other upper back exercises are up 18% (Lat Pulldown).',
    )
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
    expect(activeSlide()).toHaveTextContent('9 kg × 20')
    expect(activeSlide()).toHaveTextContent('Repeat 20 to unlock the next weight')
    expect(screen.queryByRole('region', { name: 'Tip!' })).toBeNull()
  })

  it('always lists Hypertrophy before Endurance', async () => {
    setup({ ...rowExercise, ranges: [...rowExercise.ranges].reverse() })
    const tabs = await screen.findAllByRole('tab', { name: /Hypertrophy|Endurance/ })
    expect(tabs.map((t) => t.textContent)).toEqual(['Hypertrophy', 'Endurance'])
  })

  it("shows the only range trained in the toggle's place, but not as a toggle", async () => {
    setup({ ...rowExercise, ranges: [rowExercise.ranges[1]], default_range: 'light' })
    await screen.findByRole('region', { name: 'Progress' })
    const header = screen.getByRole('heading', { level: 1 }).closest('header')!
    expect(within(header).queryByRole('tab')).toBeNull()
    expect(within(header).getByText('Endurance')).toHaveAttribute('title', '13+ reps')
  })
})
