import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockApi, renderApp } from '../test/render'
import { bicepsMuscle, bodyMap, exerciseSummaries, recent, status } from '../test/fixtures'

afterEach(() => vi.unstubAllGlobals())

const chestMuscle = { ...bicepsMuscle, group: 'chest', label: 'Chest', change_pct: 13.6 }

function setup(path = '/') {
  mockApi({
    '/api/body-map': bodyMap,
    '/api/status': status,
    '/api/search': recent,
    '/api/exercises': { exercises: exerciseSummaries },
    '/api/muscles/chest': chestMuscle,
  })
  return renderApp(path)
}

describe('body map page', () => {
  it('colours each muscle and labels it for screen readers', async () => {
    setup()
    expect(await screen.findAllByRole('button', { name: 'Chest: Progressing' })).not.toHaveLength(0)
    expect(screen.getAllByRole('button', { name: 'Hamstrings: Declining' })).not.toHaveLength(0)
    expect(
      screen.getAllByRole('button', { name: 'Biceps: Progressing, not trained in 3+ weeks' }),
    ).not.toHaveLength(0)
  })

  it('asks you to tap a muscle before one is chosen', async () => {
    setup()
    expect(await screen.findByText('Tap a muscle to see its exercises')).toBeInTheDocument()
  })

  it('shows a tapped muscle and its exercises under the map, remembered in the address', async () => {
    const { router } = setup()
    const [chest] = await screen.findAllByRole('button', { name: /^Chest/ })
    await userEvent.click(chest)
    expect(router.state.location.pathname).toBe('/')
    expect(router.state.location.search).toBe('?muscle=chest')
    expect(chest).toHaveAttribute('aria-pressed', 'true')

    const spotlight = await screen.findByRole('region', { name: 'Chest exercises' })
    const header = within(spotlight).getByRole('link', { name: /Chest/ })
    expect(header).toHaveAttribute('href', '/muscles/chest')
    expect(await within(spotlight).findByText('+13.6%')).toBeInTheDocument()

    // Only exercises that mainly work chest, each with its own Last · This · Next cards.
    expect(within(spotlight).getByRole('link', { name: /Bench Press/ })).toHaveAttribute(
      'href',
      '/exercises/BENCH',
    )
    expect(within(spotlight).getByRole('link', { name: /Cable Fly/ })).toBeInTheDocument()
    expect(within(spotlight).queryByText(/Bicep Curl/)).toBeNull()
    const bench = within(spotlight).getByRole('region', { name: 'Bench Press sessions' })
    expect(within(bench).getAllByRole('article', { hidden: true })).toHaveLength(3)
  })

  it('opens the muscle page at the top, not where the home page was scrolled to', async () => {
    const { router } = setup('/?muscle=chest')
    const spotlight = await screen.findByRole('region', { name: 'Chest exercises' })
    vi.mocked(window.scrollTo).mockClear()
    await userEvent.click(within(spotlight).getByRole('link', { name: /Week by week/ }))
    expect(router.state.location.pathname).toBe('/muscles/chest')
    await waitFor(() => expect(window.scrollTo).toHaveBeenCalledWith(0, 0))
  })

  it('opens straight onto a muscle from a shared link', async () => {
    setup('/?muscle=chest')
    expect(await screen.findByRole('region', { name: 'Chest exercises' })).toBeInTheDocument()
  })

  it('selects a muscle with the keyboard', async () => {
    const { router } = setup()
    const [chest] = await screen.findAllByRole('button', { name: /^Chest/ })
    chest.focus()
    await userEvent.keyboard('{Enter}')
    expect(router.state.location.search).toBe('?muscle=chest')
  })

  it('has a four-item legend', async () => {
    setup()
    const legend = await screen.findByRole('list', { name: 'Legend' })
    expect(
      within(legend)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Progressing', 'Not progressing', 'Declining', 'Not trained in 3+ weeks'])
  })

  it('explains when the data is not available', async () => {
    mockApi({ '/api/body-map': { error: "Your Hevy data isn't available yet." } }, 503)
    renderApp('/')
    expect(await screen.findByRole('alert')).toHaveTextContent("isn't available yet")
  })
})

describe('search', () => {
  async function openSearch() {
    await userEvent.click(screen.getByRole('button', { name: 'Search exercises and muscles' }))
  }

  it('is an icon until opened, then shows recent exercises', async () => {
    setup()
    expect(screen.queryByRole('combobox')).toBeNull()
    await openSearch()
    expect(screen.getByRole('combobox')).toHaveFocus()
    expect(await screen.findByText('Recent')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Seated Cable Row/ })).toHaveAttribute(
      'href',
      '/exercises/ROW',
    )
  })

  it('searches as you type, and closes after choosing a result', async () => {
    const fetchMock = mockApi({
      '/api/body-map': bodyMap,
      '/api/status': status,
      '/api/search': { exercises: [], muscles: [{ group: 'upper_back', label: 'Upper back' }] },
    })
    const { router } = renderApp('/')
    await openSearch()
    await userEvent.type(screen.getByRole('combobox'), 'back')
    const urls = () => fetchMock.mock.calls.map(([url]) => String(url))
    await waitFor(() => expect(urls()).toContain('/api/search?q=back'))
    expect(urls()).not.toContain('/api/search?q=ba') // waits for typing to pause

    await userEvent.click(await screen.findByRole('option', { name: /Upper back/ }))
    expect(router.state.location.pathname).toBe('/muscles/upper_back')
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('closes with Escape', async () => {
    setup()
    await openSearch()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('combobox')).toBeNull()
  })
})
