"""
Personal corrections to Hevy's muscle labels.

Hevy labels each exercise with the muscles it usually works, but technique can shift
the work elsewhere: a leg press with feet high and toes turned out is a glute exercise.
Corrections apply across the whole app (body map, muscle pages and the next session),
matched by exercise title.
"""

from collections.abc import Iterable
from dataclasses import replace

from backend.domain.models import ExerciseTemplate

# Title → (primary muscle, secondary muscles).
MUSCLE_CORRECTIONS: dict[str, tuple[str, tuple[str, ...]]] = {
    # Feet high, toes out: glute-focused.
    "Leg Press Horizontal (Machine)": ("glutes", ("quadriceps", "hamstrings")),
    "Leg Press (Machine)": ("glutes", ("quadriceps", "hamstrings")),
    # Hevy files it under full body; it's mostly quads.
    "Wall Ball": ("quadriceps", ("glutes",)),
}


def correct_muscles(templates: Iterable[ExerciseTemplate]) -> list[ExerciseTemplate]:
    """The templates, with any corrected muscles swapped in."""
    corrected = []
    for t in templates:
        if t.title in MUSCLE_CORRECTIONS:
            primary, secondary = MUSCLE_CORRECTIONS[t.title]
            t = replace(t, primary_muscle_group=primary, secondary_muscle_groups=secondary)
        corrected.append(t)
    return corrected
