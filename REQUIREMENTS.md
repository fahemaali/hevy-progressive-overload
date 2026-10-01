# Requirements

## Goal

Show, per muscle group, whether I am progressively overloading, and suggest how to keep doing
so in my next session. Data comes from my own Hevy account via the Hevy public API.

The app is used in two ways:

- **Today** (phone, at the gym): pick a routine, see a target for each exercise.
- **Review** (phone or laptop): progress by muscle group and by exercise.

It is deployed publicly and shows my real training data, so privacy rules apply (see below).

## Data from Hevy

| Endpoint | Used for |
| --- | --- |
| `GET /v1/workouts` | Logged sessions: exercises → sets with `type`, `weight_kg`, `reps`, `duration_seconds` |
| `GET /v1/workouts/events?since=` | Incremental sync: workouts `updated` or `deleted` since the last sync |
| `GET /v1/exercise_templates` | `type`, `equipment`, `primary_muscle_group`, `secondary_muscle_groups` |
| `GET /v1/routines` | Planned sessions; workouts carry `routine_id`, so the next routine can be suggested |

The API does **not** return Hevy's estimated 1RM, so the app calculates it.

## Privacy

- The app only calls the endpoints above. Hevy also exposes `/user/info` and
  `/body_measurements`; the client refuses to call them (enforced in code and tested).
- Free-text workout descriptions and exercise notes are dropped when data is stored.
- Dates are shown as calendar dates only, never times of day.
- The API key stays on the server. Visitors can't make the app call Hevy; refreshes are
  scheduled server-side.

## Rules

### Working sets
All sets except those tagged **warm-up** in Hevy. (Untagged sets are treated as working sets.
Tag warm-ups in Hevy by tapping the set number and choosing **W**.)

### Estimated 1-rep max
Epley formula, per set: `e1RM = weight × (1 + reps / 30)`.

### Rep ranges: compare like with like
Epley is accurate at low reps but increasingly generous at high reps (60 kg × 5 → 70 kg, while
40 kg × 20 → 67 kg). Comparing a heavy session with a light, high-rep one would show false
progress or decline, so each exercise is tracked in two ranges:

- **Strength:** 1–12 reps
- **High-rep:** 13+ reps (e1RM shown, labelled as a rough estimate)

A session is only compared with earlier sessions in the same range.

### Exercise types (from the template `type`)

| Type | Progress measured by |
| --- | --- |
| `weight_reps`, `bodyweight_weighted` | e1RM per rep range; volume (weight × reps) |
| `reps_only` | Best reps in a set; total reps |
| `bodyweight_assisted` | Assistance weight, where **less is better** |
| `duration` | Longest hold |
| distance, floors, steps types | Not tracked; listed as such |

### Judging a session
Every session of an exercise is compared with earlier sessions **of the same exercise, in the
same rep range**. Different exercises are never compared by weight: 9 kg on a cable curl and
10 kg on a barbell preacher curl aren't the same effort.

- **Recent level:** the median of up to the last 3 earlier sessions. Judging starts from the
  second session, using whatever history exists.
- **Best:** the best earlier session in that rep range, however long ago.

The change against the recent level is rounded to one decimal place, as shown on screen, then:

| Result | Rule | Colour |
| --- | --- | --- |
| ▲ Progressing | more than +2% | green |
| ● Not progressing | within ±2% (standing still is a warning sign) | amber |
| ▼ Declining | less than −2% | red |
| New baseline | first session in this rep range; counts from the next one | grey |

Each result has a plain-English reason that also says where it stands against the best, e.g.
"Strength e1RM up 4.0% vs your recent level · 13.3% off your best" or "… · new best".

### Muscle groups, week by week
Each week (Monday to Sunday), a muscle's status combines the results of every session that week
of an exercise that trains it:

- Exercises where it's the **primary** muscle count fully; **secondary** count half.
- **▲ Progressing** if more than half of the counted weight is ▲.
- **▼ Declining** if more than half is ▼.
- **● Not progressing** otherwise (e.g. one ▲ and one ●).
- New-baseline sessions don't count; a week with only those shows "Not enough data yet".

A muscle's **current status** is its most recent week that could be judged. Alongside it, a
**strength list** shows each exercise that trains the muscle (primary first, then most recent):
its latest working set and its best in that rep range.

### Suggestions for the next session
Two options, shown equally, each with the resulting e1RM change, staying within the rep range
of the last session:

- **Add weight:** the next increment, at the fewest reps that still beat the last e1RM
  (e.g. 52.5 kg × 9 → 55 kg × 8), but never more than 2 reps below last time (10 kg × 12 →
  15 kg × 10, not × 1) and never below the bottom of the rep range.
- **Add reps:** the same weight for one more rep. Not offered at the top of the Strength range
  (12 reps), where adding weight is the way forward.

Other exercise types get a single step: one more rep (bodyweight), 5 seconds longer (holds), or
less assistance / one more rep (assisted).

Default increments by template `equipment`: barbell 2.5 kg, dumbbell 2 kg, machine 5 kg,
others 2.5 kg.

### Units
Stored and shown in kg. lb is a later extra.
