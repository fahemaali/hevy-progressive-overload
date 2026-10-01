import type { Trend } from '../api/types'
import { TREND_INFO } from '../trends'
import styles from './TrendMark.module.css'

/** ▲ ● ▼ in its status colour; the label is always available, shown or not. */
export function TrendMark({ trend, showLabel = false }: { trend: Trend; showLabel?: boolean }) {
  const { symbol, label, color } = TREND_INFO[trend]
  return (
    <span className={styles.mark} title={showLabel ? undefined : label}>
      <span aria-hidden="true" style={{ color }} className={styles.symbol}>
        {symbol}
      </span>
      {showLabel ? <span>{label}</span> : <span className="visually-hidden">{label}</span>}
    </span>
  )
}
