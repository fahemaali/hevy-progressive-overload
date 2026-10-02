"""Double progression with 2-for-2 confirmation, and the stall rule."""

from itertools import pairwise

import pytest

from backend.domain.models import ExerciseTemplate, LoggedSet
from backend.domain.plan import MAX_CLIMB, Plan, PlanStep
from backend.domain.progress import analyse_exercise
from backend.domain.targets import Target
from tests.domain.helpers import hold, lift, template, weekly

BARBELL = template(equipment="barbell")  # 2.5 kg increments


def sets(weight: float | None, *reps: int) -> tuple[LoggedSet, ...]:
    return tuple(lift(weight, r) for r in reps)


def plan_after(*sessions: tuple[LoggedSet, ...], t: ExerciseTemplate = BARBELL) -> Plan:
    progress = analyse_exercise(t, weekly(*sessions)).default_range
    assert progress is not None
    return progress.plan


def target(weight: float | None, reps: int | None, n_sets: int = 3) -> Target:
    return Target(weight_kg=weight, reps=reps, sets=n_sets)


# --- Building reps -------------------------------------------------------------------


def test_building_adds_one_rep_to_the_lowest_set() -> None:
    plan = plan_after(sets(50, 10, 9, 8))
    assert plan.step is PlanStep.BUILDING
    assert plan.today == target(50, 9)  # every set to at least 9
    assert plan.then == target(50, 10)
    assert plan.reps_to_go == 4  # 8 → 12


def test_building_works_up_from_below_the_range() -> None:
    plan = plan_after(sets(60, 5, 5, 5))
    assert plan.today == target(60, 6)


# --- Confirm, then add weight (2-for-2) ------------------------------------------------


def test_top_of_range_once_asks_to_confirm() -> None:
    plan = plan_after(sets(50, 11, 11, 11), sets(50, 12, 12, 12))
    assert plan.step is PlanStep.CONFIRM
    assert plan.today == target(50, 12)
    assert plan.then == target(52.5, 8)  # if confirmed, the weight goes up


def test_top_of_range_twice_in_a_row_adds_weight() -> None:
    plan = plan_after(sets(50, 12, 12, 12), sets(50, 12, 12, 12))
    assert plan.step is PlanStep.ADD_WEIGHT
    assert plan.today == target(52.5, 8)  # one increment, bottom of the range
    assert plan.then == target(52.5, 9)


def test_all_working_sets_must_reach_the_top() -> None:
    plan = plan_after(sets(50, 12, 12, 12), sets(50, 12, 12, 11))
    assert plan.step is PlanStep.BUILDING
    assert plan.today == target(50, 12)


def test_confirmation_must_be_at_the_same_weight() -> None:
    plan = plan_after(sets(47.5, 12, 12, 12), sets(50, 12, 12, 12))
    assert plan.step is PlanStep.CONFIRM


def test_light_range_works_between_15_and_20() -> None:
    plan = plan_after(sets(20, 20, 20), sets(20, 21, 20))
    assert plan.step is PlanStep.ADD_WEIGHT
    assert plan.today == target(22.5, 15, n_sets=2)


def test_increment_follows_equipment() -> None:
    plan = plan_after(sets(20, 12), sets(20, 12), t=template(equipment="dumbbell"))
    assert plan.today == target(22, 8, n_sets=1)


# --- The climb to the next weight ------------------------------------------------------


def test_climb_runs_through_confirming_to_the_next_weight() -> None:
    plan = plan_after(sets(50, 10, 9, 8))
    assert [(t.weight_kg, t.reps) for t in plan.climb] == [
        (50, 9),
        (50, 10),
        (50, 11),
        (50, 12),
        (50, 12),  # the repeat that unlocks the next weight
        (52.5, 8),
    ]
    assert plan.climb[:2] == (plan.today, plan.then)


def test_climb_from_a_new_weight_runs_to_the_one_after() -> None:
    plan = plan_after(sets(50, 12, 12, 12), sets(50, 12, 12, 12))
    assert plan.climb[0] == target(52.5, 8)
    assert plan.climb[-1] == target(55, 8)


def test_climb_without_a_weight_to_add_is_two_steps() -> None:
    reps = plan_after(sets(None, 12, 10), t=template(type_="reps_only"))
    assert reps.climb == (Target(reps=13, sets=2), Target(reps=14, sets=2))


def test_climb_is_capped_when_reps_can_only_go_up() -> None:
    plan = plan_after(sets(0, 12), sets(0, 12), t=template(type_="bodyweight_assisted"))
    assert len(plan.climb) == MAX_CLIMB


# --- Stalled ---------------------------------------------------------------------------


def test_three_sessions_without_progress_at_one_weight_steps_back() -> None:
    plan = plan_after(sets(60, 8, 8, 8), sets(60, 8, 8, 7), sets(60, 8, 7, 7), sets(60, 8, 7, 7))
    assert plan.step is PlanStep.STALLED
    assert plan.today == target(55, 8)  # ~10% in whole 2.5 kg steps: 6 kg → 5 kg
    assert plan.then == target(55, 9)  # then build back up


def test_extra_reps_on_weaker_sets_are_not_a_stall() -> None:
    # The best set never changes, but each session adds a rep somewhere.
    plan = plan_after(sets(60, 9, 8, 8), sets(60, 9, 9, 8), sets(60, 9, 9, 9), sets(60, 10, 9, 9))
    assert plan.step is PlanStep.BUILDING


def test_a_step_back_does_not_trigger_another_step_back() -> None:
    plan = plan_after(
        sets(60, 8, 8, 8),
        sets(60, 8, 8, 7),
        sets(60, 8, 7, 7),
        sets(60, 8, 7, 7),
        sets(55, 8, 8, 8),
    )
    assert plan.step is PlanStep.BUILDING


def test_step_back_is_at_least_one_increment() -> None:
    machine = template(equipment="machine")  # 5 kg steps; 10% of 20 kg is only 2 kg
    plan = plan_after(*[sets(20, 8)] * 4, t=machine)
    assert plan.step is PlanStep.STALLED
    assert plan.today.weight_kg == 15


# --- Ahead of plan ---------------------------------------------------------------------


def test_doing_more_than_planned_is_flagged_and_the_plan_moves_on() -> None:
    plan = plan_after(sets(50, 8, 8, 8), sets(50, 10, 10, 10))  # target was 50 × 9
    assert plan.ahead_of_plan
    assert plan.today == target(50, 11)


# --- Other exercise types --------------------------------------------------------------


def test_assisted_removes_assistance_after_confirming() -> None:
    assisted = template(type_="bodyweight_assisted", equipment="machine")
    plan = plan_after(sets(25, 12, 12), sets(25, 12, 12), t=assisted)
    assert plan.step is PlanStep.ADD_WEIGHT
    assert plan.today == target(20, 8, n_sets=2)  # less assistance is harder


def test_assisted_step_back_adds_assistance() -> None:
    assisted = template(type_="bodyweight_assisted", equipment="machine")
    plan = plan_after(*[sets(25, 8)] * 4, t=assisted)
    assert plan.step is PlanStep.STALLED
    assert plan.today.weight_kg == 30


def test_unassisted_keeps_adding_reps() -> None:
    assisted = template(type_="bodyweight_assisted")
    plan = plan_after(sets(0, 12), sets(0, 12), t=assisted)
    assert plan.step is PlanStep.BUILDING
    assert plan.today == target(0, 13, n_sets=1)


def test_reps_only_and_duration() -> None:
    reps = plan_after(sets(None, 12, 10), t=template(type_="reps_only"))
    assert reps.today == Target(reps=13, sets=2)
    assert reps.then == Target(reps=14, sets=2)

    plank = plan_after((hold(60),), t=template(type_="duration"))
    assert (plank.today.duration_seconds, plank.then.duration_seconds) == (65, 70)


@pytest.mark.parametrize("type_", ["distance_duration", "steps_duration"])
def test_untracked_types_have_no_plan(type_: str) -> None:
    progress = analyse_exercise(template(type_=type_), weekly((hold(600),)))
    assert progress.ranges == ()


# --- Never lowered by a bad day -------------------------------------------------------


def test_falling_short_holds_the_target_instead_of_lowering_it() -> None:
    # 45 kg × 4, so the plan asked for 45 × 5; then a lighter session at 35 kg.
    plan = plan_after(sets(45, 4), sets(35, 8, 12), t=template(equipment="barbell"))
    assert plan.step is PlanStep.CATCH_UP
    assert plan.today == target(45, 5, n_sets=2)  # back on track, not down to 35
    assert plan.then == target(45, 6, n_sets=2)


def test_fewer_reps_at_the_same_weight_also_holds_the_target() -> None:
    plan = plan_after(sets(50, 9, 9, 9), sets(50, 8, 8, 8))  # target was 50 × 10
    assert plan.step is PlanStep.CATCH_UP
    assert plan.today == target(50, 10)


def test_beating_the_plan_still_moves_it_up() -> None:
    plan = plan_after(sets(50, 8, 8, 8), sets(55, 8, 8, 8))  # target was 50 × 9
    assert plan.step is PlanStep.BUILDING
    assert plan.today == target(55, 9)


def test_assisted_more_assistance_holds_the_target() -> None:
    assisted = template(type_="bodyweight_assisted", equipment="machine")
    plan = plan_after(sets(25, 8), sets(30, 8), t=assisted)  # target was 25 × 9
    assert plan.step is PlanStep.CATCH_UP
    assert plan.today == target(25, 9, n_sets=1)


@pytest.mark.parametrize(
    "weights",
    # Never three misses in a row here: that's a stall, a deliberate drop tested above.
    [
        [45, 35, 40, 50],
        [60, 55, 65, 50, 70],
        [20, 25, 15, 30, 10, 35],
    ],
)
def test_targets_never_go_down_except_a_stall_step_back(weights: list[float]) -> None:
    progress = analyse_exercise(BARBELL, weekly(*[sets(w, 8, 8) for w in weights]))
    rp = progress.default_range
    assert rp is not None
    targets = [r.target for r in rp.results if r.target] + [rp.plan.today, rp.plan.then]
    for earlier, later in pairwise(targets):
        assert (later.weight_kg or 0, later.reps or 0) >= (
            earlier.weight_kg or 0,
            earlier.reps or 0,
        )


# --- Stuck chasing one target -------------------------------------------------------


MACHINE = template(equipment="machine")  # 5 kg steps


def test_three_misses_of_the_same_target_step_back_from_it() -> None:
    # Like the V-grip row: 34 kg x 5 sets a 34 x 6 target, then three lighter sessions.
    plan = plan_after(sets(34, 5), sets(13.5, 12), sets(22.5, 10, 10), sets(29.5, 7, 7), t=MACHINE)
    assert plan.step is PlanStep.STALLED
    assert plan.today.weight_kg == 29  # about 10% under 34, in one 5 kg step
    assert plan.today.reps == 8  # back to the bottom of the range
    assert plan.then == target(29, 9, n_sets=2)


def test_two_misses_still_hold_the_target() -> None:
    plan = plan_after(sets(34, 5), sets(22.5, 10), sets(29.5, 7), t=MACHINE)
    assert plan.step is PlanStep.CATCH_UP
    assert plan.today.weight_kg == 34


def test_a_step_back_resets_the_count_so_it_cannot_spiral() -> None:
    # After stepping back to 29 kg x 8, one more miss isn't a new stall.
    plan = plan_after(
        sets(34, 5),
        sets(13.5, 12),
        sets(22.5, 10, 10),
        sets(29.5, 7, 7),
        sets(25, 8),
        t=MACHINE,
    )
    assert plan.step is PlanStep.CATCH_UP
    assert plan.today.weight_kg == 29
