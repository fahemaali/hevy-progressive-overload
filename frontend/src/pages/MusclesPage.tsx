import { useBodyMap } from '../api/client'
import { ErrorMessage, Loading } from '../components/Feedback'
import { MuscleNav } from '../components/MuscleNav'
import styles from './MusclesPage.module.css'

/** Phones: every muscle you train, with its status (the sidebar list on wide screens). */
export function MusclesPage() {
  const { error, isPending } = useBodyMap()
  return (
    <>
      <h1 className={styles.title}>Muscles</h1>
      {isPending && <Loading label="Loading muscles" />}
      {error && <ErrorMessage error={error} />}
      <section className={styles.card} aria-label="Muscles">
        <MuscleNav />
      </section>
    </>
  )
}
