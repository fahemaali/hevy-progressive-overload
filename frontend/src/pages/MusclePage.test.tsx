import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockApi, renderApp } from '../test/render'
import { bicepsMuscle, bodyMap, status } from '../test/fixtures'

afterEach(() => vi.unstubAllGlobals())

function setup(muscle: unknown = bicepsMuscle, httpStatus = 200) {
  mockApi(
    { '/api/muscles/biceps': muscle, '/api/body-map': bodyMap, '/api/status': status },
    httpStatus,
  )
  return renderApp('/muscles/biceps')
}

describe('muscle page', () => {
  it('names the muscle with its status symbol', async () => {
    setup()
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Biceps: Progressing' }),
    ).toBeInTheDocument()
  })

  it('shows the muscle-wide change under its name', async () => {
    setup()
    const change = await screen.findByText(/in the week of 21 Sept/)
    expect(change).toHaveTextContent('+14.4% in the week of 21 Sept')
  })

  it('dates every week, opens on the latest judged week, and lets you pick another', async () => {
    setup()
    const weeks = await screen.findByRole('radiogroup', { name: 'Week' })
    expect(within(weeks).getAllByRole('radio')).toHaveLength(3)
    expect(within(weeks).getByRole('radio', { checked: true })).toHaveAccessibleName(
      'Week of 21 Sept: Progressing, +14.4%',
    )
    expect(
      within(weeks).getByRole('radio', { name: /28 Sept: Not enough data yet/ }),
    ).toHaveTextContent('28 Sept')

    await userEvent.click(within(weeks).getByRole('radio', { name: /7 Sept/ }))
    expect(within(weeks).getByRole('radio', { checked: true })).toHaveAccessibleName(
      'Week of 7 Sept: Declining, −4.5%',
    )
    expect(screen.getByRole('list', { name: /week of 7 Sept/ })).toHaveTextContent('Lat Pulldown')
  })

  it('dates each session in a week, and names its rep range and role', async () => {
    setup()
    const list = await screen.findByRole('list', { name: /week of 21 Sept/ })
    const items = within(list)
      .getAllByRole('listitem')
      .map((li) => li.textContent)
    expect(items).toEqual([
      expect.stringMatching(/Seated Cable Row.*25 Sept · hypertrophy · indirect/),
      expect.stringMatching(/Bicep Curl \(Cable\).*26 Sept · hypertrophy$/),
      expect.stringMatching(/^New.*Bicep Curl \(Cable\).*26 Sept · endurance/),
    ])
  })

  it('lists exercises by how they work the muscle, with best set and est. 1RM', async () => {
    setup()
    const direct = await screen.findByRole('region', { name: 'Biceps exercises' })
    const curl = within(direct).getByRole('link', { name: /Bicep Curl/ })
    expect(curl).toHaveAttribute('href', '/exercises/CURL')
    expect(curl).toHaveTextContent('Best set: 9.1 kg × 10')
    expect(curl).toHaveTextContent('Est. 1RM12.1 kg')

    const indirect = screen.getByRole('region', { name: 'Also works biceps' })
    expect(within(indirect).getByRole('link', { name: /Seated Cable Row/ })).toHaveTextContent(
      'Best set: 34 kg × 5',
    )
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

describe('navigation', () => {
  it('lists trained muscles A–Z with their status, marking the current one', async () => {
    setup()
    const nav = (await screen.findByRole('heading', { name: 'Muscles' })).parentElement!
    const links = await within(nav).findAllByRole('link')
    expect(links.map((a) => a.textContent)).toEqual(
      ['Biceps▲', 'Calves–', 'Chest▲', 'Forearms–', 'Hamstrings▼', 'Quadriceps●'].filter(
        (t) => !t.startsWith('Forearms'),
      ),
    ) // indirect-only muscles aren't listed
    expect(within(nav).getByRole('link', { name: /Biceps/ })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('has a back button on inner pages, which falls back to the body map', async () => {
    const { router } = setup()
    await userEvent.click(await screen.findByRole('button', { name: 'Back' }))
    expect(router.state.location.pathname).toBe('/')
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull()
  })
})
