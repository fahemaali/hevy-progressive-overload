import styles from './Card.module.css'

/** A white panel, optionally titled. */
export function Card({
  title,
  action,
  children,
  label,
}: {
  title?: string
  action?: React.ReactNode
  children: React.ReactNode
  label?: string
}) {
  return (
    <section className={styles.card} aria-label={label ?? title}>
      {(title || action) && (
        <div className={styles.header}>
          {title && <h2 className={styles.title}>{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}
