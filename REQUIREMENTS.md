# Requirements

## Goal

Make sure I keep progressively overloading, exercise by exercise and muscle by muscle, and tell
me exactly what to lift next. Data comes from my own Hevy account via the Hevy public API.

The app is used in two moments:

- **At the gym, mid-workout (phone):** search for the exercise I'm about to do and see today's
  target, the one after, and whether my other exercises show I could lift more.
- **Reviewing progress (phone or laptop):** a body map coloured by each muscle's status; tap a
  muscle to see its exercises, then an exercise to see its history.

It is deployed publicly and shows my real training data, so privacy rules apply (see below).
Text is kept to a minimum: symbols, numbers and colour first, at most one short line of words.

## Data from Hevy

| Endpoint | Used for |
| --- | --- |
| `GET /v1/workouts` | Logged sessions: exercises → sets with `type`, `weight_kg`, `reps`, `duration_seconds` |
| `GET /v1/workouts/events?since=` | Incremental sync: workouts `updated` or `deleted` since the last sync |
| `GET /v1/exercise_templates` | `type`, `equipment`, `primary_muscle_group`, `secondary_muscle_groups` |
| `GET /v1/routines` | Planned sessions (for later features) |

- The API does **not** return Hevy's estimated 1RM, so the app calculates it.
- Hevy only shares a workout once it's finished, so mid-session the app plans from previous
  sessions, not the sets logged so far today.

## Privacy

- The app only calls the endpoints above. Hevy also exposes `/user/info` and
  `/body_measurements`; the client refuses to call them (enforced in code and tested).
- Free-text workout descriptions and exercise notes are dropped when data is read in.
- Dates are shown as calendar dates only, never times of day.
- The API key stays on the server. Visitors can't make the app call Hevy; refreshes are
  scheduled server-side.

## Rules

### Working sets
All sets except those tagged **warm-up** in Hevy. (Untagged sets are treated as working sets.
Tag warm-ups in Hevy by tapping the set number and choosing **W**.)

### Rep ranges: Strength and Light
Each exercise is tracked as two separate progressions, because a heavy session and a light,
high-rep one can't be compared fairly (see e1RM below):

| Range | Shown as | Sets counted | Plan aims for |
| --- | --- | --- | --- |
| **Strength** (the default view) | **Hypertrophy** | up to 12 reps | 8–12 reps |
| **Light** | **Endurance** | 13+ reps | 15–20 reps |

The screen uses the established training terms (NSCA): hypertrophy for roughly 6–12 reps and
muscular endurance for 12+, which match the plan's targets. (The code calls them strength and
light.)

A session with both heavy and light sets counts once in each range.

### Estimated 1-rep max (e1RM)
Epley formula, per set: `e1RM = weight × (1 + reps / 30)`. It combines weight and reps into one
number, so extra reps count as progress, not just extra weight. It's accurate at low reps but
increasingly generous at high reps (60 kg × 5 → 70 kg, while 40 kg × 20 → 67 kg), which is why
the two ranges are kept apart. Shown as the exercise's headline "Est. 1RM" number.

### Exercise types (from the template `type`)

| Type | Progress measured by | Plan |
| --- | --- | --- |
| `weight_reps`, `bodyweight_weighted` | e1RM | Double progression, adding weight |
| `bodyweight_assisted` | Assistance weight, where **less is better** | Double progression, removing assistance |
| `reps_only` | Best set's reps | One more rep |
| `duration` | Longest hold | 5 seconds longer |
| distance, floors, steps types | Not tracked | – |

### The plan: double progression with 2-for-2
For each exercise and rep range, the next target comes from the latest sessions:

1. **Building:** same weight, one more rep than the lowest set last time, up to the top of the
   range.
2. **Confirm:** reached the top of the range on all working sets once → repeat it, so one good day
   doesn't push the weight up too early.
3. **Add weight:** reached the top on all working sets **two sessions in a row** → add one
   increment and drop to the bottom of the range.
4. **Falling short:** if a session misses its target (lighter, or fewer reps), the plan holds
   that target rather than lowering itself. *"Back on track: 45 kg × 5"*. The plan only ever
   goes up or stays level, apart from a deliberate stall step-back.
5. **Stalled:** 3 sessions in a row at the same weight, none better than the session before it
   (no higher score, no extra total reps) → step back about 10%, in whole increments (at least
   one), and build up again.

"Working weight" is the heaviest weight used in the range that session (the least assistance,
for assisted exercises); "all working sets" means every set at that weight.

The app shows **This session** and **Next session** (what comes next if this session's target
is hit).

### Card sentences: goal-focused, worked out from each card's target
Each card says where its target sits in the story: *build to the top of the range one rep at a
time → hit the top → repeat it → unlock the next weight → start again at the bottom*.

| Card's target (Hypertrophy, at 18 kg) | Sentence |
| --- | --- |
| 18 kg × 8 | "4 more reps to hit 12" |
| 18 kg × 11 | "One more rep to hit 12" |
| 18 kg × 12, first time | "Hit 12, then repeat it to unlock the next weight" |
| 18 kg × 12, the repeat | "Repeat 12 to unlock the next weight" |
| 23 kg × 8, new weight | "New weight unlocked! Build back up to 12" |
| Fell short last time | "To get back on track: 3 more reps to hit 12" |
| Stalled | "Stalled. Let's start fresh at 55 kg and rebuild to 12" |
| Assisted | Same story, "… to unlock less assistance" / "Less assistance unlocked!" |
| Endurance | Same story with 15–20: "One more rep to hit 20" |
| Bodyweight | "Beat your best: 14 reps" |
| Timed hold | "5 more seconds than last time" | The plan always
recalculates from what was actually logged, so doing more than planned simply moves it on
(*"Ahead of plan"*). A first session has no target (*"First session: your starting point"*).

Weight increments by template `equipment`: barbell 2.5 kg, dumbbell 2 kg, machine 5 kg, others
2.5 kg.

### Judging a session
Every session is compared with earlier sessions **of the same exercise, in the same rep range**.
Different exercises are never compared by weight: 9 kg on a cable curl and 10 kg on a barbell
preacher curl aren't the same effort.

- **Recent level:** the median of up to the last 3 earlier sessions. Judging starts from the
  second session, using whatever history exists.
- **Best:** the best earlier session in that rep range, however long ago.
- **Target:** what the plan asked for, worked out from the sessions before it, so past
  sessions have targets too.

The change against the recent level is rounded to one decimal place, as shown on screen, then:

| Result | Rule | Colour |
| --- | --- | --- |
| ▲ Progressing | more than +2% | green |
| ● Not progressing | within ±2% (standing still is a warning sign) | amber |
| ▼ Declining | less than −2% | red |
| New baseline | first session in this rep range | grey |

Each result also records whether it was a new best (or how far off the best), and whether it
hit the target. These are numbers and flags; the screen turns them into symbols.

### Capacity: evidence from other exercises
For a weighted exercise, look at the other weighted exercises for the same muscle (primary
muscle counts fully, secondary half) and how much they've improved **since this exercise was
last done**, each compared with itself in the same rep range. If they've improved on average,
apply that improvement to this exercise's working weight, **capped at +10%** (trainer
guidelines put a single load increase at 2–10%; new exercises often show big early gains that
come from technique, not strength), rounded down to whole increments but at least one. Only
suggested if the evidence is worth at least one increment: *"Other upper-back exercises +10% → try
32.5 kg"*. Never shown without evidence from at least one other exercise.

### Muscle groups, week by week
Each week (Monday to Sunday), a muscle's status combines the results of every session that week
of an exercise that trains it:

- A muscle only gets a status in a week where it was **trained directly** (at least one exercise
  where it's the primary muscle). Muscles only ever trained indirectly (e.g. calves) aren't
  tracked.
- Primary exercises count fully; secondary count half.
- **▲ Progressing** if more than half of the counted weight is ▲; **▼ Declining** if more than
  half is ▼; otherwise **● Not progressing**.
- New-baseline sessions don't count.

A muscle's **% change** for a week is the average of its judged exercises' changes against
their recent level (secondary count half; for assisted exercises less assistance counts as
positive), each capped at **±25%** so one big early jump can't dominate (e.g. back extensions
going from 5 kg to 10 kg would otherwise read +110%). Shown under the muscle's name for its
latest judged week, and as a line over the week-by-week strip.

A muscle's **current status** is its most recent week that could be judged. Each muscle also
has a **strength list**: every exercise that trains it (primary first, then most recent), with
its latest working set and its best.

### Body map

| Look | Means |
| --- | --- |
| Green / amber / red | Progressing / not progressing / declining (current status) |
| Striped colour | Last trained directly more than 3 weeks ago |
| Dark grey | Only trained indirectly: not tracked |
| Light grey | Never trained |

Hevy groups with no place on a body (full body, cardio, other) aren't on the map; their
exercises are still found through search.

### Exercise screen

- Strength / Light toggle (Strength by default; Light if there are no strength sessions).
- Headline: Est. 1RM, trend (▲ +6%) and best.
- Chart with two lines in the same units: **actual** (solid) and **target** (dashed). Solid at
  or above dashed means following the plan; solid rising means getting stronger. Points are
  coloured by result; tapping one shows the actual and target sets. No e1RM numbers on the chart.
- Today / Then targets with one short line explaining the plan step.
- Capacity hint, when there's evidence.

### Units
Stored and shown in kg. lb is a later extra.
