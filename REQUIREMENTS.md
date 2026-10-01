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

### Verdict per exercise
For the rep range of the latest session, compare the latest session with the median of the
previous 3 sessions in that range within the last 8 weeks:

- **▲ Progressing:** more than +2%
- **● Holding:** within ±2%
- **▼ Declining:** less than −2%
- **Not enough data yet:** fewer than 3 earlier sessions in that range

Each verdict includes a plain-English reason, e.g. "Strength e1RM up 4.1% vs your recent median".

### Muscle-group status
Based on exercises where the group is the **primary** muscle and that were trained in the last
4 weeks, shown as "3 of 4 progressing" plus an overall status. Exercises where the group is
secondary are listed separately and don't affect the status.

### Suggestions for the next session
Two options, shown equally, each with the resulting e1RM change, staying within the rep range
of the last session:

- **Add weight:** the next increment, at the highest rep count that still beats the last e1RM.
- **Add reps:** the same weight for one more rep.

Default increments by template `equipment`: barbell 2.5 kg, dumbbell 2 kg, machine 5 kg,
others 2.5 kg.

### Units
Stored and shown in kg. lb is a later extra.
