# Requirements

## Goal

Show, per muscle group, whether I am progressively overloading — and suggest how to keep doing
so this week. Data comes from my own Hevy account via the Hevy public API.

## Data available from Hevy

- **Workouts** (`GET /v1/workouts`) — each workout lists exercises, each exercise lists sets
  with `type` (`warmup` / `normal` / `failure` / `dropset`), `weight_kg`, `reps`, `rpe`.
- **Exercise templates** (`GET /v1/exercise_templates`) — `primary_muscle_group` and
  `secondary_muscle_groups` per exercise. This is what groups exercises by muscle.
- **Routines** (`GET /v1/routines`) — what I'm planning to do next; useful for "this week".
- The API does **not** return Hevy's estimated 1RM, so we calculate it ourselves.

## Features

### 1. Muscle group view
- List of muscle groups, each with an overall status indicator (green ▲ improving,
  amber ● flat, red ▼ declining).
- Selecting one (e.g. Triceps) shows the exercises that train it, primary first.

### 2. History: am I overloading?
- For each exercise done more than once: a session-by-session history of top set,
  total reps and volume (weight × reps).
- Clear verdict per exercise: progressed / held / regressed versus recent sessions.
- Warm-up sets are excluded from all calculations.

### 3. Suggestions for this week
For each exercise, compared with the last session, offer overload options such as:
- **Add weight:** next weight increment at a target rep count.
- **Add reps:** same (or slightly lower) weight for more reps, chosen so estimated 1RM or
  volume still goes up.

### 4. Estimated 1-rep max
- Calculated per set with the Epley formula: `1RM = weight × (1 + reps / 30)`.
- Best e1RM per session, trended over time per exercise and summarised per muscle group.
- Always visible, prominently — with green/red trend indicators.

## Open questions

- What time window counts as "recent" for the trend (last 4 sessions? last 4 weeks?)
- How should secondary muscle groups count toward a muscle group's status?
- Smallest weight increment per equipment type (e.g. 2.5 kg barbell, 1 kg dumbbell, machine stack steps)?
- Only 17 workouts are logged so far — how much history is needed before showing a verdict?
