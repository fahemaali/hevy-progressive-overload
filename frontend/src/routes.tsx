import { QueryClient } from '@tanstack/react-query'
import type { RouteObject } from 'react-router'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { ComingSoon, NotFound } from './pages/Placeholders'

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/muscles/:group', element: <ComingSoon what="Muscle" /> },
      { path: '/exercises/:id', element: <ComingSoon what="Exercise" /> },
      { path: '/about', element: <ComingSoon what="About" /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000, // the server refreshes from Hevy itself; no need to refetch often
        retry: (count, error) => count < 2 && !('status' in error && error.status === 404),
      },
    },
  })
}
