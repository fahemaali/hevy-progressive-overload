import { screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockApi, renderApp } from '../test/render'
import { bodyMap, status } from '../test/fixtures'

afterEach(() => vi.unstubAllGlobals())

function setup() {
  mockApi({ '/api/body-map': bodyMap, '/api/status': status, '/api/exercises': { exercises: [] } })
  renderApp('/about')
}

describe('about page', () => {
  it('explains the app, what it does and the design decisions', async () => {
    setup()
    expect(await screen.findByRole('heading', { level: 1, name: 'About' })).toBeInTheDocument()
    expect(screen.getByText('A progressive overload coach for Hevy users.')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'What it does' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Design decisions' })).toHaveTextContent(
      'three misses in a row of the same target',
    )
  })

  it('says when the data was last refreshed from Hevy', async () => {
    setup()
    expect(await screen.findByText(/Last data refresh:/)).toHaveTextContent(
      'Last data refresh: 5 minutes ago',
    )
  })

  it('credits the author, with links that open in a new tab', async () => {
    setup()
    const made = await screen.findByRole('region', { name: 'Made by' })
    expect(made).toHaveTextContent('Fahema Ali')
    const profile = within(made).getByRole('link', { name: 'GitHub profile' })
    expect(profile).toHaveAttribute('href', 'https://github.com/fahemaali')
    expect(profile).toHaveAttribute('target', '_blank')
    expect(profile).toHaveAttribute('rel', 'noreferrer')
  })

  it('is in the main navigation', async () => {
    setup()
    const nav = await screen.findByRole('navigation', { name: 'Main' })
    expect(within(nav).getByRole('link', { name: 'About' })).toHaveAttribute('href', '/about')
  })
})
