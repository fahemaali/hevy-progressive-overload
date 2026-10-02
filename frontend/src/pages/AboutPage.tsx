import { useStatus } from '../api/client'
import { Card } from '../components/Card'
import { APP_NAME } from '../config'
import { timeAgo } from '../format'
import styles from './AboutPage.module.css'

const AUTHOR = { name: 'Fahema Ali', github: 'https://github.com/fahemaali' }
const REPO = 'https://github.com/fahemaali/hevy-progressive-overload'

/** What the app is, what it does and why it works the way it does (mirrors the README). */
export function AboutPage() {
  return (
    <div className={styles.page}>
      <div className={styles.top}>
        <h1 className={styles.title}>About</h1>
        <LastRefresh />
      </div>

      <Card label={`About ${APP_NAME}`}>
        <p className={styles.lead}>
          <strong>A progressive overload coach for Hevy users.</strong> It reads my{' '}
          <External href="https://www.hevyapp.com/">Hevy</External> workouts and answers two
          questions: <em>is each muscle actually getting stronger?</em> and{' '}
          <em>what exactly should I lift next?</em>
        </p>
        <p className={styles.note}>
          Built end to end with Claude Code (AI pair programming) as a portfolio project: product
          decisions, design reviews and every line of code, iterated in conversation. Not affiliated
          with or endorsed by Hevy.
        </p>
      </Card>

      <Card title="What it does">
        <ul className={styles.list}>
          <li>
            <strong>Body map:</strong> every muscle coloured by whether it's progressing, not
            progressing or declining, and striped if it hasn't been trained in 3+ weeks. Tap one to
            see its exercises underneath, each with a swipeable <em>Last · This · Next</em> session
            deck.
          </li>
          <li>
            <strong>A plan for every exercise:</strong> double progression. Build reps from 8 to 12
            at one weight, hit 12 twice, then add weight and start again (15–20 for endurance work).
            Each card says where you are in that story: <em>"One more rep to hit 12"</em>,{' '}
            <em>"Repeat 12 to unlock the next weight"</em>.
          </li>
          <li>
            <strong>A progress chart:</strong> what you lifted against the plan, as a strength
            score, with the plan drawn all the way to the next weight.
          </li>
          <li>
            <strong>Honest progress:</strong> each session is compared with the same exercise in the
            same rep range, never across exercises. Muscles are judged week by week; secondary
            muscles count half.
          </li>
          <li>
            <strong>Tips from other exercises:</strong> if your other glute exercises have improved
            since you last deadlifted, it suggests trying a little more (capped at +10%).
          </li>
        </ul>
        <p className={styles.more}>
          The full rules are in{' '}
          <External href={`${REPO}/blob/main/REQUIREMENTS.md`}>REQUIREMENTS.md</External>.
        </p>
      </Card>

      <Card title="Design decisions">
        <ul className={styles.list}>
          <li>
            <strong>A strength score on the graph, labelled with what was lifted.</strong> Plotting
            weight alone made rep-building look flat (29 kg × 8 → × 12 is real progress). Weight and
            reps are combined (Epley) into a unitless score, and each point says what was lifted (
            <em>29×8</em>), so the line climbs with every extra rep and the numbers stay concrete.
            The plan is drawn all the way to the next weight; on a phone the chart scrolls sideways
            with the axis pinned.
          </li>
          <li>
            <strong>Rep ranges are tracked separately</strong> (Hypertrophy ≤12, Endurance 13+).
            Epley inflates high-rep sets, so a light, high-rep day compared with a heavy one would
            show false progress.
          </li>
          <li>
            <strong>The plan never lowers itself after a bad day.</strong> Falling short holds the
            target. The only planned drop is a deliberate step back of about 10%, after three
            sessions at one weight without improving, or three misses in a row of the same target.
          </li>
          <li>
            <strong>Outliers are capped.</strong> One exercise counts at most ±25% in a muscle's or
            a tip's average, so a new exercise's early jump (e.g. +110%) can't dominate.
          </li>
          <li>
            <strong>Accessibility:</strong> status colours differ in lightness for colour-blind
            users and always come with ▲ ● ▼ or a label; text meets WCAG AA contrast; everything
            works by keyboard.
          </li>
        </ul>
      </Card>

      <Card title="Made by">
        <p className={styles.author}>
          <strong>{AUTHOR.name}</strong>
          <span className={styles.links}>
            <External href={AUTHOR.github}>GitHub profile</External>
            <External href={REPO}>Source code</External>
          </span>
        </p>
        <p className={styles.credits}>
          Body map outlines from{' '}
          <External href="https://github.com/vulovix/body-muscles">body-muscles</External> (Apache
          2.0).
        </p>
      </Card>
    </div>
  )
}

/**
 * When the app last copied data from Hevy. Only "how long ago", never a time of day,
 * which the API doesn't share.
 */
function LastRefresh() {
  const { data } = useStatus()
  if (!data?.has_data) return null
  const ago = data.synced_minutes_ago === null ? 'unknown' : timeAgo(data.synced_minutes_ago)
  return (
    <p className={styles.refresh}>
      Last data refresh: <strong>{data.refreshing ? 'refreshing now…' : ago}</strong>
      {data.refresh_failed && !data.refreshing && (
        <span className={styles.failed}> · the latest refresh failed</span>
      )}
    </p>
  )
}

/** A link that leaves the app, opened in a new tab. */
function External({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={styles.link}>
      {children}
    </a>
  )
}
