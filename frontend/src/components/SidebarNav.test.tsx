import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockApi, renderApp } from '../test/render'
import { bodyMap, exerciseSummaries, rowExercise, status } from '../test/fixtures'

beforeEach(() => window.localStorage.clear())
afterEach(() => vi.unstubAllGlobals())

function setup(path = '/') {
  mockApi({
    '/api/body-map': bodyMap,
    '/api/status': status,
    '/api/exercises': { exercises: exerciseSummaries },
    '/api/exercises/BENCH': { ...rowExercise, id: 'BENCH', title: 'Bench Press' },
  })
  const view = renderApp(path)
  const sidebar = screen.getByRole('navigation', { name: 'Sidebar' })
  const section = (name: RegExp) => within(sidebar).getByRole('button', { name })
  return { ...view, sidebar, section }
}

describe('sidebar navigation', () => {
  it('has Body map, then Muscles and Exercises as collapsible sections', () => {
    const { sidebar, section } = setup()
    expect(within(sidebar).getByRole('link', { name: 'Body map' })).toHaveAttribute('href', '/')
    expect(section(/Muscles/)).toHaveAttribute('aria-expanded', 'true')
    expect(section(/Exercises/)).toHaveAttribute('aria-expanded', 'false')
  })

  it('expands Exercises to list them grouped by muscle, and collapses again', async () => {
    const { sidebar, section } = setup()
    await userEvent.click(section(/Exercises/))
    expect(section(/Exercises/)).toHaveAttribute('aria-expanded', 'true')
    const list = document.getElementById(section(/Exercises/).getAttribute('aria-controls')!)!
    expect(await within(list).findByText('Chest')).toBeInTheDocument() // group label
    expect(within(list).getByRole('link', { name: /Bench Press/ })).toHaveAttribute(
      'href',
      '/exercises/BENCH',
    )
    await userEvent.click(section(/Exercises/))
    expect(within(sidebar).queryByRole('link', { name: /Bench Press/ })).toBeNull()
  })

  it('opens the section holding the current page', async () => {
    const { sidebar, section } = setup('/exercises/BENCH')
    expect(section(/Exercises/)).toHaveAttribute('aria-expanded', 'true')
    expect(await within(sidebar).findByRole('link', { name: /Bench Press/ })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('remembers what you opened and closed', async () => {
    const first = setup()
    await userEvent.click(first.section(/Muscles/))
    await userEvent.click(first.section(/Exercises/))
    first.unmount()

    const again = setup()
    expect(again.section(/Muscles/)).toHaveAttribute('aria-expanded', 'false')
    expect(again.section(/Exercises/)).toHaveAttribute('aria-expanded', 'true')
  })
})
