import styles from './Logo.module.css'

/** The logo mark: three bars stepping up, like sets getting heavier. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={styles.mark}>
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      <rect x="7" y="17" width="4.5" height="8" rx="1.5" fill="#ffffff" opacity="0.55" />
      <rect x="13.75" y="12" width="4.5" height="13" rx="1.5" fill="#ffffff" opacity="0.8" />
      <rect x="20.5" y="7" width="4.5" height="18" rx="1.5" fill="#ffffff" />
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
