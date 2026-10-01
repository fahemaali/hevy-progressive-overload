/**
 * Small per-browser preferences (e.g. "intro dismissed"). Storage can be blocked or
 * unavailable (private browsing), so failures fall back to "not set".
 */

export function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(`next-set:${key}`) === '1'
  } catch {
    return false
  }
}

export function writeFlag(key: string): void {
  try {
    window.localStorage.setItem(`next-set:${key}`, '1')
  } catch {
    // Not remembered this time; harmless.
  }
}
