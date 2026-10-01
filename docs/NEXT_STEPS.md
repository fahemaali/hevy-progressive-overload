# Next steps

What's left to do on Next Set, in rough priority order. Each item says what's wrong or
wanted, and what's been agreed so far.

## Bugs (phone)

### 1. Muscle header overlaps on long names
**Where:** Body map → tap a muscle → the panel's top row (e.g. **Abdominals +18.3%**, *Week by
week ›*).
**Problem:** on a phone, a long single-word name like *Abdominals* runs into the percentage and
the *Week by week* link. Two-word names (*Upper back*) wrap instead, which is less bad but
still untidy.
**Fix idea:** put *Week by week ›* on its own line under the name, or shrink the name on
narrow screens so it never collides.

### 2. Exercise rows look busy
**Where:** the exercise rows under the body map, on a phone.
**Problem:** too much in each row's header, and it's inconsistent. Some show *Hypertrophy*
and *New*, some only *New*, some a percentage; long names wrap; sizes vary.
**Fix idea:** one consistent layout. The exercise name on its own line, then a single small
line of facts in a fixed order (e.g. *Hypertrophy · ▲ +6%*, or *Hypertrophy · New*), or move
the range into the cards. To agree on before building.

## Features

### 3. Sidebar navigation rework (web)
- Body map, **Muscles** and **Exercises** should all look and behave the same, as top-level items.
- Muscles and Exercises become **collapsible sections** (an "accordion"): click to expand or
  collapse, with a chevron showing which.
- Their contents are **nested items**, indented underneath: each muscle with its status
  symbol, each exercise.
- To decide: 58 exercises is a long list, so group it by muscle or add a filter box.
- The phone's bottom tab bar stays as it is.

### 4. About page (parked)
- How the app works, in plain English, and the privacy note.
- The **last updated** time (removed from the header earlier).
- The intro text (*"Next Set turns Hevy workouts into a progressive overload plan…"*),
  reworded.

### 5. Summary page redesign (parked)
- The four legend items become **filter tabs**: Progressing · Not progressing · Declining ·
  Not trained in 3+ weeks. Pick one to list just those muscles, biggest change first.
- Each muscle shows its **% change** (already calculated for the muscle page).
- New card styles. Reference sites: [Collect UI](https://collectui.com),
  [Dribbble](https://dribbble.com), [Mobbin](https://mobbin.com).

## Plan logic

### 6. The plan can hold an old peak forever
**Example:** V-Grip Seated Row. The plan still asks for 34 kg (from 31 Aug) after three
lighter sessions.
**Why:** the plan never lowers itself after a short session (agreed), and the stall rule only
triggers for three sessions at the *same* weight.
**Fix idea:** treat **three missed targets in a row** as a stall too: *"Stalled. Let's start
fresh at … kg and rebuild to 12"*.

### 7. Open questions from review
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
