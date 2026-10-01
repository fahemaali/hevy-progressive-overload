import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => cleanup())

// jsdom has no scrolling; page navigation calls it.
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
