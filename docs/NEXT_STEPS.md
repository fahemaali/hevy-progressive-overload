# Next steps

What's left to do on Next Set, in rough priority order. Each item says what's wrong or
wanted, and what's been agreed so far.

## Done

- ~~Muscle header overlap on long names~~: *Week by week* drops to its own line on phones.
- ~~Busy exercise rows~~: the name on its own line, then one quiet line of facts in a fixed
  order (*Hypertrophy · ▲ +6%*).
- ~~Sidebar navigation rework~~: Body map, Muscles and Exercises as matching items; Muscles and
  Exercises collapse and expand, with indented items (exercises grouped by muscle).

## Features

### 1. About page (parked)
- How the app works, in plain English, and the privacy note.
- The **last updated** time (removed from the header earlier).
- The intro text (*"Next Set turns Hevy workouts into a progressive overload plan…"*),
  reworded.

### 2. Summary page redesign (parked)
- The four legend items become **filter tabs**: Progressing · Not progressing · Declining ·
  Not trained in 3+ weeks. Pick one to list just those muscles, biggest change first.
- Each muscle shows its **% change** (already calculated for the muscle page).
- New card styles. Reference sites: [Collect UI](https://collectui.com),
  [Dribbble](https://dribbble.com), [Mobbin](https://mobbin.com).

## Plan logic

### 3. The plan can hold an old peak forever
**Example:** V-Grip Seated Row. The plan still asks for 34 kg (from 31 Aug) after three
lighter sessions.
**Why:** the plan never lowers itself after a short session (agreed), and the stall rule only
triggers for three sessions at the *same* weight.
**Fix idea:** treat **three missed targets in a row** as a stall too: *"Stalled. Let's start
fresh at … kg and rebuild to 12"*.

### 4. Open questions from review
- **Rep labels on the chart:** the graph shows weight, so adding reps at the same weight
  looks flat (e.g. Bicep Curl: 9.1 kg × 8 → 9.1 kg × 10). Small "×10" labels on each point
  would show the progress. Not decided.
- **Tip card when there's no evidence:** it only appears when other exercises give evidence.
  Should it always show, with *"not enough evidence yet"*? Not decided.

## Later

- **Send targets to Hevy:** write each exercise's next target into your Hevy routine, so it
  shows inside Hevy itself. Owner-only, never available to visitors. Agreed as a later phase.
- **lb as well as kg.**

## Optional (hosting)

- **Custom domain** (e.g. `nextset.app`): about £10–20 a year from a registrar, connected
  in Render's settings with free HTTPS.
- **No sleeping:** Render's Starter plan ($7/month) stops the ~30–60 second wake-up after 15
  quiet minutes. One click in Render's dashboard; no code changes.
