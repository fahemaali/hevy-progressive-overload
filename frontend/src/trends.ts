import type { Trend } from './api/types'

/** How each session or week result reads: symbol, label and status colour. */
export const TREND_INFO: Record<Trend, { symbol: string; label: string; color: string }> = {
  up: { symbol: '▲', label: 'Progressing', color: 'var(--progressing)' },
  flat: { symbol: '●', label: 'Not progressing', color: 'var(--not-progressing)' },
  down: { symbol: '▼', label: 'Declining', color: 'var(--declining)' },
  new: { symbol: '+', label: 'New baseline', color: 'var(--text-muted)' },
  insufficient: { symbol: '–', label: 'Not enough data yet', color: 'var(--text-muted)' },
}
