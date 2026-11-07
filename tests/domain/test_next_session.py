from datetime import timedelta

from backend.domain.corrections import correct_muscles
from backend.domain.models import ExerciseTemplate, LoggedSet, PerformedExercise, Routine, Workout
from backend.domain.next_session import (
    DEFAULT_MINUTES_PER_EXERCISE,
    Half,
    NextSession,
    minutes_per_exercise,
    next_half,
    plan_next_session,
    workout_half,
)
from backend.domain.progress import analyse_all, muscle_group_summaries
from backend.domain.targets import Target
from tests.domain.helpers import DAY_ONE, lift, template

# One exercise per muscle unless a test adds more; ids name the muscle.
TEMPLATES = {
    t.id: t
    for t in [
        template(primary="hamstrings", equipment="machine", id_="HAM"),
        template(primary="chest", equipment="machine", id_="CHEST"),
        template(primary="lats", equipment="machine", id_="LATS"),
        template(primary="quadriceps", equipment="machine", id_="QUADS"),
        template(primary="upper_back", equipment="machine", id_="ROW"),
        template(primary="shoulders", equipment="machine", id_="PRESS"),
        template(primary="abductors", equipment="machine", id_="ABDUCT"),
        template("reps_only", primary="other", id_="TKE"),
        template("reps_only", primary="other", id_="BAND"),
    ]
}

A_DAY = ("HAM", "CHEST", "LATS")
B_DAY = ("QUADS", "ROW", "PRESS")


def session(
    day: int,
    *exercises: str | tuple[str, tuple[LoggedSet, ...]],
    minutes: int | None = 60,
    routine: str | None = None,
) -> Workout:
    """A workout `day` days after DAY_ONE. Each exercise is an id (3 × 20 kg × 10) or
    an (id, sets) pair."""
    performed = []
    for ex in exercises:
        template_id, sets = ex if isinstance(ex, tuple) else (ex, (lift(20, 10),) * 3)
        performed.append(PerformedExercise(template_id, sets))
    return Workout(f"W{day}", DAY_ONE + timedelta(days=day), routine, tuple(performed), minutes)


def plan(
    workouts: list[Workout],
    today_day: int,
    templates: dict[str, ExerciseTemplate] | None = None,
    routines: list[Routine] | None = None,
) -> NextSession:
    templates = templates or TEMPLATES
    progress = analyse_all(templates.values(), workouts)
    muscles = {m.group: m for m in muscle_group_summaries(progress.values())}
    today = DAY_ONE + timedelta(days=today_day)
    return plan_next_session(progress, muscles, workouts, routines or [], today)


def groups(s: NextSession) -> list[str]:
    return [m.group for m in s.muscles]


# --- Which half is next ------------------------------------------------------------------


def test_a_workout_is_the_half_most_of_its_muscles_belong_to() -> None:
    assert workout_half(session(0, *A_DAY), TEMPLATES) is Half.A
    assert workout_half(session(0, *B_DAY, "HAM"), TEMPLATES) is Half.B


def test_an_even_mix_goes_by_the_routine_name() -> None:
    mixed = session(0, "HAM", "ROW")
    assert workout_half(mixed, TEMPLATES) is None
    assert workout_half(mixed, TEMPLATES, "Day 3 a") is Half.A
    assert workout_half(mixed, TEMPLATES, "Day 4 b 15th Sep") is Half.B
    assert workout_half(mixed, TEMPLATES, "Arms day") is None


def test_the_next_half_is_the_other_one_from_the_last_clear_workout() -> None:
    workouts = [session(0, *A_DAY), session(2, "HAM", "ROW")]  # the last one is a mix
    halves = {w.id: workout_half(w, TEMPLATES) for w in workouts}
    assert next_half(workouts, halves) is Half.B
    assert next_half([], {}) is Half.A


def test_the_session_trains_the_halfs_muscles() -> None:
    s = plan([session(0, *A_DAY), session(2, *B_DAY)], today_day=4)
    assert s.half is Half.A
    assert groups(s) == ["hamstrings", "chest", "lats"]


def test_routine_names_settle_a_mixed_last_workout() -> None:
    workouts = [
        Workout("W0", DAY_ONE, "R1", session(0, "HAM", "ROW").exercises, 60),
    ]
    s = plan(workouts, today_day=2, routines=[Routine("R1", "Day 3 a", ())])
    assert s.half is Half.B


def test_muscles_the_last_session_already_trained_are_skipped() -> None:
    # The last session was a B day that also did hamstrings (an A muscle).
    s = plan([session(0, *A_DAY), session(2, *B_DAY, "HAM")], today_day=4)
    assert s.half is Half.A
    assert groups(s) == ["chest", "lats"]


def test_muscles_the_last_session_missed_are_caught_up() -> None:
    # The last session was a B day without shoulders.
    workouts = [session(0, *B_DAY), session(2, *A_DAY), session(4, "QUADS", "ROW")]
    s = plan(workouts, today_day=6)
    assert s.half is Half.A
    assert groups(s) == ["hamstrings", "chest", "lats", "shoulders"]


def test_after_a_week_away_the_session_is_the_whole_half() -> None:
    workouts = [session(0, *A_DAY), session(2, *B_DAY, "HAM")]
    assert groups(plan(workouts, today_day=9)) == ["chest", "lats"]  # 7 days: still a pair
    assert groups(plan(workouts, today_day=10)) == ["hamstrings", "chest", "lats"]


def test_catching_up_never_runs_past_the_time_limit() -> None:
    # 30 minutes an exercise: only 3 fit in 90.
    workouts = [session(0, *A_DAY, minutes=90), session(2, "QUADS", minutes=30)]
    assert groups(plan(workouts, today_day=4)) == ["hamstrings", "chest", "lats"]


# --- Options for each muscle --------------------------------------------------------------


def test_the_favourite_is_the_one_done_most_on_that_halfs_days() -> None:
    templates = {
        **TEMPLATES,
        "FLY": template(primary="chest", equipment="machine", id_="FLY"),
        "PUSHUP": template("reps_only", primary="chest", id_="PUSHUP"),
    }
    workouts = [
        session(0, "HAM", "CHEST", "LATS"),
        session(2, *B_DAY, "PUSHUP"),  # done often, but on B days
        session(4, "HAM", "CHEST", "LATS"),
        session(6, *B_DAY, "PUSHUP"),
        session(8, "HAM", "FLY", "LATS"),
        session(10, *B_DAY),
    ]
    chest = next(m for m in plan(workouts, 12, templates).muscles if m.group == "chest")
    titles = [o.exercise.template.id for o in chest.options]
    assert titles[0] == "CHEST"
    assert chest.options[0].favourite
    assert not any(o.favourite for o in chest.options[1:])
    assert set(titles[1:]) == {"FLY", "PUSHUP"}


def test_alternatives_are_the_runner_up_then_the_longest_since_done() -> None:
    extra = {f"C{i}": template(primary="chest", equipment="machine", id_=f"C{i}") for i in range(5)}
    templates = {**TEMPLATES, **extra}
    workouts = [
        session(0, "HAM", "C0", "LATS"),  # C0: done longest ago
        session(1, "HAM", "C1", "LATS"),
        session(2, "HAM", "C2", "LATS"),
        session(3, "HAM", "C3", "LATS"),
        session(4, "HAM", "C3", "LATS"),  # C3: the runner-up
        session(5, "HAM", "C4", "LATS"),
        *[session(6 + i, "HAM", "CHEST", "LATS") for i in range(3)],  # the favourite
        session(10, *B_DAY),
    ]
    chest = next(m for m in plan(workouts, 12, templates).muscles if m.group == "chest")
    assert [o.exercise.template.id for o in chest.options] == ["CHEST", "C3", "C0", "C1"]


def test_lagging_muscles_go_first() -> None:
    falling = (lift(20, 10), lift(20, 10))
    workouts = [
        session(0, *A_DAY),
        session(2, *B_DAY),
        session(4, ("HAM", falling), "CHEST", "LATS"),
        session(6, *B_DAY),
        session(8, ("HAM", (lift(15, 8), lift(15, 8))), "CHEST", "LATS"),
        session(10, *B_DAY),
    ]
    assert groups(plan(workouts, 12))[0] == "hamstrings"
    workouts[4] = session(8, ("LATS", (lift(10, 8),)), "HAM", "CHEST")
    assert groups(plan(workouts, 12))[0] == "lats"


# --- Targets -------------------------------------------------------------------------------


def test_targets_follow_the_plan() -> None:
    s = plan([session(0, *A_DAY), session(2, *B_DAY)], today_day=4)
    # 20 kg × 10 on 3 sets: one more rep next time.
    assert s.muscles[0].options[0].target == Target(20, 11, sets=3)


def test_after_three_weeks_away_the_target_is_last_time() -> None:
    workouts = [session(0, *A_DAY), session(2, *B_DAY)]
    assert plan(workouts, today_day=21).muscles[0].options[0].target == Target(20, 10, sets=3)
    assert plan(workouts, today_day=20).muscles[0].options[0].target == Target(20, 11, sets=3)


def test_the_target_is_in_the_range_most_sets_were_in_last_time() -> None:
    mixed = ("HAM", (lift(15.5, 12), lift(13.5, 15), lift(13.5, 15)))
    s = plan([session(0, mixed, "CHEST", "LATS"), session(2, *B_DAY)], today_day=4)
    assert s.muscles[0].options[0].target == Target(13.5, 16, sets=2)


# --- Extras and time -----------------------------------------------------------------------


def test_an_overdue_extra_is_added_to_its_half() -> None:
    workouts = [session(0, *B_DAY, "ABDUCT"), session(2, *A_DAY)]
    s = plan(workouts, today_day=10)
    assert groups(s)[-1] == "abductors"
    assert s.muscles[-1].extra
    assert not any(m.extra for m in s.muscles[:-1])


def test_a_recently_trained_extra_is_left_out() -> None:
    workouts = [session(0, *B_DAY, "ABDUCT"), session(2, *A_DAY)]
    assert "abductors" not in groups(plan(workouts, today_day=9))


def test_an_extra_is_left_out_when_the_session_would_run_too_long() -> None:
    # Each exercise takes 30 minutes here: 3 + 1 won't fit in 90.
    workouts = [session(0, *B_DAY, "ABDUCT", minutes=120), session(2, *A_DAY, minutes=90)]
    assert "abductors" not in groups(plan(workouts, today_day=10))


def test_minutes_per_exercise_ignores_workouts_left_running() -> None:
    workouts = [
        session(0, "HAM", "CHEST", minutes=20),
        session(1, "HAM", "CHEST", minutes=22),
        session(2, "HAM", "CHEST", minutes=24),
        session(3, "HAM", "CHEST", minutes=100),  # far longer than usual
        session(4, "HAM", "CHEST", minutes=200),  # over two hours
        session(5, "HAM", "CHEST", minutes=None),
    ]
    assert minutes_per_exercise(workouts) == 11
    assert minutes_per_exercise([]) == DEFAULT_MINUTES_PER_EXERCISE


def test_mobility_comes_from_the_same_halfs_days() -> None:
    reps = (LoggedSet(False, None, 20, None),)
    workouts = [session(0, *A_DAY, ("TKE", reps)), session(2, *B_DAY, ("BAND", reps))]
    s = plan(workouts, today_day=4)
    assert [o.exercise.template.id for o in s.mobility] == ["TKE"]
    assert s.mobility[0].target == Target(reps=21, sets=1)


# --- Corrections ---------------------------------------------------------------------------


def test_corrections_move_exercises_to_the_muscle_they_really_work() -> None:
    hevy = [
        ExerciseTemplate("LP", "Leg Press Horizontal (Machine)", "weight_reps", "quadriceps",
                         ("hamstrings", "glutes"), "machine"),
        ExerciseTemplate("WB", "Wall Ball", "weight_reps", "full_body", (), "other"),
        ExerciseTemplate("LE", "Leg Extension (Machine)", "weight_reps", "quadriceps", (),
                         "machine"),
    ]  # fmt: skip
    leg_press, wall_ball, leg_extension = correct_muscles(hevy)
    assert leg_press.primary_muscle_group == "glutes"
    assert "quadriceps" in leg_press.secondary_muscle_groups
    assert wall_ball.primary_muscle_group == "quadriceps"
    assert leg_extension == hevy[2]
