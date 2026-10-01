import { screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockApi, renderApp } from '../test/render'
import { bodyMap, exerciseSummaries, status } from '../test/fixtures'

afterEach(() => vi.unstubAllGlobals())

describe('exercises page', () => {
  it('lists every exercise by muscle, with its trend and this session', async () => {
    mockApi({
      '/api/exercises': { exercises: exerciseSummaries },
      '/api/body-map': bodyMap,
      '/api/status': status,
    })
    renderApp('/exercises')
    const chest = await screen.findByRole('region', { name: 'Chest' })
    const bench = within(chest).getByRole('link', { name: /Bench Press/ })
    expect(bench).toHaveAttribute('href', '/exercises/BENCH')
    expect(bench).toHaveTextContent('This session: 29.5 kg × 8')
    expect(within(chest).getByRole('link', { name: /Cable Fly/ })).toHaveTextContent('New')
    expect(screen.getByRole('region', { name: 'Biceps' })).toHaveTextContent('Bicep Curl')
  })

  it('is in the main navigation', async () => {
    mockApi({
      '/api/exercises': { exercises: [] },
      '/api/body-map': bodyMap,
      '/api/status': status,
    })
    renderApp('/')
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(within(nav).getByRole('link', { name: 'Exercises' })).toHaveAttribute(
      'href',
      '/exercises',
    )
  })
})
