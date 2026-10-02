import { useStatus } from '../api/client'
import { Card } from '../components/Card'
import { APP_NAME } from '../config'
import { timeAgo } from '../format'
import { TREND_INFO } from '../trends'
import styles from './AboutPage.module.css'
import bodyMap from './guide/body-map.webp'
import chart from './guide/chart.webp'
import spotlight from './guide/spotlight.webp'
import tip from './guide/tip.webp'
import weekByWeek from './guide/week-by-week.webp'

const AUTHOR = { name: 'Fahema Ali', github: 'https://github.com/fahemaali' }
const REPO = 'https://github.com/fahemaali/hevy-progressive-overload'

/**
 * What the app is, a short illustrated guide to using it, and why it works the way it
 * does (the README's intro and design decisions). Screenshots are of the real app.
 */
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

      <h2 className={styles.section}>How to use it</h2>

      <Guide
        step={1}
        title="See every muscle at a glance"
        image={bodyMap}
        alt="The body map, front and back, with each muscle coloured by its progress"
        narrow
      >
        <p>
          The <strong>body map</strong> colours every muscle by how it's doing:{' '}
          <Status trend="up" />, <Status trend="flat" />, <Status trend="down" />, and striped if it
          hasn't been trained in 3+ weeks. Muscles are judged week by week; exercises where a muscle
          only helps out (secondary) count half.
        </p>
      </Guide>

      <Guide
        step={2}
        title="Tap a muscle to see what to lift"
        image={spotlight}
        alt="Glutes selected: Deadlift with its last session, this session and next session cards"
      >
        <p>
          Its exercises appear underneath, each with swipeable <em>Last · This · Next</em> cards.{' '}
          <strong>This session</strong> is what to lift today. The plan is double progression: build
          reps from 8 to 12 at one weight, hit 12 twice, then add weight and start again (15–20 for
          endurance work).
        </p>
        <p>
          Each card says where you are in that story: <em>"One more rep to hit 12"</em>,{' '}
          <em>"Repeat 12 to unlock the next weight"</em>. Miss a target and it's held, not lowered:{' '}
          <em>"To get back on track…"</em>.
        </p>
      </Guide>

      <Guide
        step={3}
        title="Follow your progress against the plan"
        image={chart}
        alt="The progress chart: your sessions as a solid line, the plan as a dashed line climbing to the next weight"
      >
        <p>
          Open an exercise for its <strong>progress chart</strong>. The solid line is you, the
          dashed line is the plan. Staying on or above the dashed line means you're on plan.
        </p>
        <p>
          Both are a <strong>strength score</strong>: weight and reps combined, so one more rep at
          the same weight still counts. Each point says what was lifted (<em>29×8</em>), and each
          dot's colour compares that session with your recent level. The plan carries on past{' '}
          <em>This</em> and <em>Next</em> all the way to your next weight. On a phone, swipe the
          chart sideways.
        </p>
      </Guide>

      <Guide
        step={4}
        title="Check a muscle week by week"
        image={weekByWeek}
        alt="Week by week for abdominals: a line through each week's result, and a coloured square per week"
      >
        <p>
          From a muscle, <strong>View week by week</strong> shows each week's verdict and the
          sessions behind it. Weeks you skipped are dashed. Each session is compared only with the
          same exercise in the same rep range, never across exercises.
        </p>
      </Guide>

      <Guide
        step={5}
        title="Take the tips"
        image={tip}
        alt="A tip suggesting 47.5 kg, because the other glute exercises are up 10%"
      >
        <p>
          If your other exercises for a muscle have improved since you last did this one, a{' '}
          <strong>Tip</strong> suggests trying a little more (capped at +10%).
        </p>
      </Guide>

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
        <p className={styles.more}>
          The full rules are in{' '}
          <External href={`${REPO}/blob/main/REQUIREMENTS.md`}>REQUIREMENTS.md</External>.
        </p>
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

/** A status as the map shows it: its symbol in its colour, then its name. */
function Status({ trend }: { trend: 'up' | 'flat' | 'down' }) {
  const { symbol, label, color } = TREND_INFO[trend]
  return (
    <strong>
      <span style={{ color }} aria-hidden="true">
        {symbol}
      </span>{' '}
      {label.toLowerCase()}
    </strong>
  )
}

/** One step of the guide: a heading, a few lines, and a screenshot of that part of the app. */
function Guide({
  step,
  title,
  image,
  alt,
  narrow = false,
  children,
}: {
  step: number
  title: string
  image: string
  alt: string
  narrow?: boolean // tall pictures (the body map) shown smaller
  children: React.ReactNode
}) {
  return (
    <section className={styles.guide} aria-label={title}>
      <h3 className={styles.step}>
        <span className={styles.number} aria-hidden="true">
          {step}
        </span>
        {title}
      </h3>
      <div className={styles.text}>{children}</div>
      <img
        src={image}
        alt={alt}
        loading="lazy"
        className={styles.shot}
        data-narrow={narrow || undefined}
      />
    </section>
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
