import styles from './Logo.module.css'

/** The logo mark: a barbell tilted upward, for lifting and progress. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={styles.mark}>
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      <g transform="rotate(-28 16 16)" fill="#ffffff">
        <rect x="3" y="14.8" width="26" height="2.4" rx="1.2" />
        <rect x="7" y="9" width="3.4" height="14" rx="1.4" />
        <rect x="21.6" y="9" width="3.4" height="14" rx="1.4" />
        <rect x="4.1" y="11.5" width="2.4" height="9" rx="1.1" />
        <rect x="25.5" y="11.5" width="2.4" height="9" rx="1.1" />
      </g>
    </svg>
  )
}

/** Mark + wordmark, optionally with the tagline underneath. */
export function Logo({ tagline = false }: { tagline?: boolean }) {
  return (
    <span className={styles.logo}>
      <LogoMark />
      <span className={styles.text}>
        <span className={styles.wordmark}>
          Next <span className={styles.accent}>Set</span>
        </span>
        {tagline && <span className={styles.tagline}>Progressive overload coach for Hevy</span>}
      </span>
    </span>
  )
}
