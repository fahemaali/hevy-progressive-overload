import { QueryClient } from '@tanstack/react-query'
import type { RouteObject } from 'react-router'
import { Layout } from './components/Layout'
import { ExercisePage } from './pages/ExercisePage'
import { HomePage } from './pages/HomePage'
import { MusclePage } from './pages/MusclePage'
import { MusclesPage } from './pages/MusclesPage'
import { NotFound } from './pages/Placeholders'

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/muscles', element: <MusclesPage /> },
      { path: '/muscles/:group', element: <MusclePage /> },
      { path: '/exercises/:id', element: <ExercisePage /> },
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
