import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockApi, renderApp } from '../test/render'
import { bodyMap, recent, status } from '../test/fixtures'

afterEach(() => vi.unstubAllGlobals())

function setup() {
  mockApi({ '/api/body-map': bodyMap, '/api/status': status, '/api/search': recent })
  return renderApp('/')
}

describe('home page', () => {
  it('colours each muscle and labels it for screen readers', async () => {
    setup()
    expect(await screen.findAllByRole('button', { name: 'Chest: Progressing' })).not.toHaveLength(0)
    expect(screen.getAllByRole('button', { name: 'Hamstrings: Declining' })).not.toHaveLength(0)
    expect(
      screen.getAllByRole('button', {
        name: 'Biceps: Progressing, last trained over 3 weeks ago',
      }),
    ).not.toHaveLength(0)
  })

  it('opens a muscle when it is tapped on the map', async () => {
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

  it('lists muscles by status, as an alternative to colour', async () => {
    setup()
    const list = await screen.findByRole('region', { name: 'Muscles by status' })
    const progressing = within(list).getByRole('heading', { name: /Progressing/ })
    expect(progressing).toHaveTextContent('2')
    expect(within(list).getByRole('link', { name: 'Hamstrings' })).toHaveAttribute(
      'href',
      '/muscles/hamstrings',
    )
    expect(within(list).getByRole('link', { name: /Biceps/ })).toHaveTextContent('3 wk+')
    expect(within(list).queryByRole('link', { name: 'Neck' })).toBeNull() // never trained
  })

  it('shows how fresh the data is', async () => {
    setup()
    expect(await screen.findByText('Updated 5 min ago')).toBeInTheDocument()
  })

  it('explains when the data is not available', async () => {
    mockApi({ '/api/body-map': { error: "Your Hevy data isn't available yet." } }, 503)
    renderApp('/')
    expect(await screen.findByRole('alert')).toHaveTextContent("isn't available yet")
  })
})

describe('search', () => {
  it('shows recent exercises before anything is typed', async () => {
    setup()
    await userEvent.click(screen.getByRole('combobox'))
    expect(await screen.findByText('Recent')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Seated Cable Row/ })).toHaveAttribute(
      'href',
      '/exercises/ROW',
    )
  })

  it('searches as you type', async () => {
    const fetchMock = mockApi({
      '/api/body-map': bodyMap,
      '/api/status': status,
      '/api/search': { exercises: [], muscles: [{ group: 'upper_back', label: 'Upper back' }] },
    })
    renderApp('/')
    await userEvent.type(screen.getByRole('combobox'), 'back')
    expect(await screen.findByRole('option', { name: /Upper back/ })).toHaveAttribute(
      'href',
      '/muscles/upper_back',
    )
    const urls = () => fetchMock.mock.calls.map(([url]) => String(url))
    await waitFor(() => expect(urls()).toContain('/api/search?q=back'))
    expect(urls()).not.toContain('/api/search?q=ba') // waits for typing to pause
  })

  it('closes with Escape', async () => {
    setup()
    await userEvent.click(screen.getByRole('combobox'))
    await screen.findByRole('listbox')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})
