/** How numbers, sets and dates are written across the app. */
import type { Mode, Target, WorkingSet } from './api/types'

/** 52.5 → "52.5", 50 → "50" */
export function kg(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '')
}

/** "+4.1%", "−2.5%", "0%" (a real minus sign) */
export function pct(value: number): string {
  if (value === 0) return '0%'
  const sign = value > 0 ? '+' : '−'
  return `${sign}${Math.abs(value).toFixed(1).replace(/\.0$/, '')}%`
}

/** "29 Sep" (dates arrive as "2026-09-29") */
export function shortDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

/** What was done: "29.5 kg × 7, 7", "12, 10 reps", "60 s", "20 kg assist × 8". */
export function formatSet(set: WorkingSet, mode: Mode): string {
  const reps = set.reps.join(', ')
  switch (mode) {
    case 'load':
      return `${kg(set.weight_kg ?? 0)} kg × ${reps}`
    case 'assisted':
      return `${kg(set.weight_kg ?? 0)} kg assist × ${reps}`
    case 'reps':
      return `${reps} reps`
    default:
      return `${set.duration_seconds ?? 0} s`
  }
}

/** What to aim for: "29.5 kg × 8", "13 reps", "65 s", "20 kg assist × 8". */
export function formatTarget(target: Target, mode: Mode): string {
  switch (mode) {
    case 'load':
      return `${kg(target.weight_kg ?? 0)} kg × ${target.reps}`
    case 'assisted':
      return `${kg(target.weight_kg ?? 0)} kg assist × ${target.reps}`
    case 'reps':
      return `${target.reps} reps`
    default:
      return `${target.duration_seconds ?? 0} s`
  }
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}
