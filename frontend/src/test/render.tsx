import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { createQueryClient, routes } from '../routes'

/** Renders the whole app at `path`, as a user would see it. */
export function renderApp(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const queryClient = createQueryClient()
  queryClient.setDefaultOptions({
    queries: { ...queryClient.getDefaultOptions().queries, retry: false },
  })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { ...view, router }
}

/** Fakes the API: `responses` maps a path (with query) to the JSON it returns. */
export function mockApi(responses: Record<string, unknown>, status = 200) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    const match = Object.keys(responses).find((key) => url === key || url.startsWith(`${key}?`))
    if (match === undefined) {
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
    }
    return new Response(JSON.stringify(responses[match]), { status })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}
