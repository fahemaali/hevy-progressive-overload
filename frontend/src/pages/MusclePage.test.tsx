import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockApi, renderApp } from '../test/render'
import { bicepsMuscle, status } from '../test/fixtures'

afterEach(() => vi.unstubAllGlobals())

function setup(muscle: unknown = bicepsMuscle, httpStatus = 200) {
  mockApi({ '/api/muscles/biceps': muscle, '/api/status': status }, httpStatus)
  return renderApp('/muscles/biceps')
}

describe('muscle page', () => {
  it('shows the muscle and its status', async () => {
    setup()
    expect(await screen.findByRole('heading', { level: 1, name: 'Biceps' })).toBeInTheDocument()
    expect(screen.getByText('Progressing', { selector: 'header *' })).toBeInTheDocument()
  })

  it('opens on the latest week that could be judged, and lets you pick another', async () => {
    setup()
    const weeks = await screen.findByRole('radiogroup', { name: 'Week' })
    const selected = within(weeks).getByRole('radio', { checked: true })
    expect(selected).toHaveAccessibleName('Week of 21 Sept: Progressing')
    expect(
      screen.getByRole('link', { name: 'Bicep Curl (Cable)', hidden: false }),
    ).toBeInTheDocument()

    await userEvent.click(within(weeks).getByRole('radio', { name: /7 Sept/ }))
    expect(screen.getByRole('heading', { name: /Week of 7 Sept/ })).toHaveTextContent('Declining')
    expect(screen.getAllByText('indirect').length).toBeGreaterThan(0)
  })

  it('lists direct exercises apart from those that also work it', async () => {
    setup()
    const direct = await screen.findByRole('region', { name: 'Exercises' })
    expect(within(direct).getByRole('link', { name: /Bicep Curl/ })).toHaveAttribute(
      'href',
      '/exercises/CURL',
    )
    expect(within(direct).getByText('9.1 kg × 10, 10, 10 · 26 Sept')).toBeInTheDocument()

    const indirect = screen.getByRole('region', { name: 'Also works it' })
    expect(within(indirect).getByRole('link', { name: /Seated Cable Row/ })).toBeInTheDocument()
  })

  it('says so when nothing has trained it', async () => {
    setup({ ...bicepsMuscle, state: 'never_trained', weeks: [], exercises: [] })
    expect(await screen.findByText('No exercises for this muscle yet.')).toBeInTheDocument()
  })

  it('shows the API error for an unknown muscle', async () => {
    setup({ error: 'Unknown muscle group: nope' }, 404)
    expect(await screen.findByRole('alert')).toHaveTextContent('Unknown muscle group')
  })
})
