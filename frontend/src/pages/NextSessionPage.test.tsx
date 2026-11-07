import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bodyMap, nextSession, status } from '../test/fixtures'
import { mockApi, renderApp } from '../test/render'

afterEach(() => vi.unstubAllGlobals())

function show(session = nextSession) {
  mockApi({ '/api/next-session': session, '/api/body-map': bodyMap, '/api/status': status })
  return renderApp('/next')
}

describe('next session page', () => {
  it('shows each muscle in order, with its main exercise and target', async () => {
    show()
    const hamstrings = await screen.findByRole('region', { name: 'Hamstrings' })
    const cards = screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'))
    expect(cards.slice(0, 3)).toEqual(['Hamstrings', 'Chest', 'Abductors'])

    expect(hamstrings).toHaveTextContent('Declining')
    expect(hamstrings).toHaveTextContent('Last trained 43 days ago')
    expect(screen.getByRole('region', { name: 'Chest' })).toHaveTextContent(
      'Last trained 1 day ago',
    )
    const main = within(hamstrings).getByRole('group', { name: /Seated Leg Curl/ })
    expect(main).toHaveTextContent('Seated Leg Curl (Machine)★Favourite')
    expect(main).toHaveTextContent('13.5 kg × 15')
    expect(main).toHaveTextContent('2 sets')
  })

  it('offers the alternatives, chosen with the dots', async () => {
    const user = userEvent.setup()
    show()
    const hamstrings = await screen.findByRole('region', { name: 'Hamstrings' })
    const dots = within(hamstrings).getByRole('tablist')
    expect(
      within(dots)
        .getAllByRole('tab')
        .map((t) => t.getAttribute('aria-label')),
    ).toEqual(['Seated Leg Curl (Machine)', 'Nordic Hamstrings Curls', 'Good Morning (Barbell)'])
    await user.click(within(dots).getByRole('tab', { name: 'Nordic Hamstrings Curls' }))
    expect(within(dots).getByRole('tab', { name: 'Nordic Hamstrings Curls' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    // One exercise only: nothing to choose between.
    expect(
      within(screen.getByRole('region', { name: 'Chest' })).queryByRole('tablist'),
    ).not.toBeInTheDocument()
  })

  it('names the routine the session is close to, and what to change in a copy', async () => {
    const user = userEvent.setup()
    show()
    const note = await screen.findByText(/Based on/)
    expect(note).toHaveTextContent('Based on Day 1 a')
    expect(note).toHaveTextContent('Add Hip Abduction (Machine)')
    expect(note).toHaveTextContent('Remove Torso Rotation')

    // Swapping to an alternative changes what to do to the copy.
    const hamstrings = screen.getByRole('region', { name: 'Hamstrings' })
    await user.click(within(hamstrings).getByRole('tab', { name: 'Good Morning (Barbell)' }))
    expect(screen.getByText(/Based on/)).toHaveTextContent(
      'Add Good Morning (Barbell), Hip Abduction (Machine)',
    )
    expect(screen.getByText(/Based on/)).toHaveTextContent(
      'Remove Seated Leg Curl (Machine), Torso Rotation',
    )
  })

  it('on a low energy day, drops a set from each exercise and leaves out the extras', async () => {
    const user = userEvent.setup()
    show()
    await screen.findByRole('region', { name: 'Hamstrings' })
    expect(screen.getByRole('region', { name: 'Mobility · pick one' })).toBeInTheDocument()

    const button = screen.getByRole('button', { name: 'Low energy day' })
    await user.click(button)
    expect(button).toHaveAttribute('aria-pressed', 'true')
    const hamstrings = screen.getByRole('region', { name: 'Hamstrings' })
    expect(
      within(hamstrings).getByRole('group', { name: /Seated Leg Curl/ }),
    ).not.toHaveTextContent('sets')
    expect(within(screen.getByRole('region', { name: 'Chest' })).getByText('2 sets')).toBeVisible()
    expect(screen.queryByRole('region', { name: 'Abductors' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Mobility · pick one' })).not.toBeInTheDocument()
    // Without the extra, the session matches Day 1 a but for one swap.
    expect(screen.getByText(/Based on/)).not.toHaveTextContent('Add')

    await user.click(button)
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('region', { name: 'Abductors' })).toBeInTheDocument()
  })

  it('offers mobility as a choice of one, not a list', async () => {
    show({
      ...nextSession,
      mobility: [
        ...nextSession.mobility,
        { ...nextSession.mobility[0], id: 'BAND', title: 'Band Pullaparts' },
      ],
    })
    const mobility = await screen.findByRole('region', { name: 'Mobility · pick one' })
    expect(mobility).toHaveTextContent('Optional')
    const tabs = within(within(mobility).getByRole('tablist')).getAllByRole('tab')
    expect(tabs.map((t) => t.getAttribute('aria-label'))).toEqual([
      'Banded Terminal knee extensions',
      'Band Pullaparts',
    ])
    expect(within(mobility).getByText('or')).toBeInTheDocument()
  })

  it('asks for a first workout when there is nothing to plan from', async () => {
    show({ ...nextSession, muscles: [], mobility: [] })
    expect(await screen.findByText('Log a workout in Hevy to get your next session.')).toBeVisible()
  })

  it('is in the main navigation', async () => {
    show()
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(within(nav).getByRole('link', { name: 'Next session' })).toHaveAttribute('href', '/next')
    // Last before About, in both the phone tab bar and the wide-screen sidebar.
    expect(
      within(nav)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual(['Body map', 'Muscles', 'Exercises', 'Next session', 'About'])
    const sidebar = screen.getByRole('navigation', { name: 'Sidebar' })
    const items = within(sidebar).getAllByRole('link')
    const names = items.map((l) => l.textContent)
    expect(names.indexOf('Next session')).toBe(names.indexOf('About') - 1)
  })
})
