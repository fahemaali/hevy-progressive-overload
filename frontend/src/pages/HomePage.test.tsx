import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockApi, renderApp } from '../test/render'
import { bodyMap, recent, status } from '../test/fixtures'

afterEach(() => vi.unstubAllGlobals())

function setup(path = '/') {
  mockApi({ '/api/body-map': bodyMap, '/api/status': status, '/api/search': recent })
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

  it('opens a muscle when it is tapped', async () => {
    const { router } = setup()
    const [chest] = await screen.findAllByRole('button', { name: /^Chest/ })
    await userEvent.click(chest)
    expect(router.state.location.pathname).toBe('/muscles/chest')
  })

  it('opens a muscle with the keyboard', async () => {
    const { router } = setup()
    const [chest] = await screen.findAllByRole('button', { name: /^Chest/ })
    chest.focus()
    await userEvent.keyboard('{Enter}')
    expect(router.state.location.pathname).toBe('/muscles/chest')
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
