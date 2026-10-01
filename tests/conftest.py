import json
from pathlib import Path
from typing import Any

import pytest

FIXTURES = Path(__file__).parent / "fixtures"


def load_fixture(name: str) -> Any:
    return json.loads((FIXTURES / f"{name}.json").read_text())


@pytest.fixture
def workouts() -> list[dict[str, Any]]:
    data: list[dict[str, Any]] = load_fixture("workouts")
    return data


@pytest.fixture
def exercise_templates() -> list[dict[str, Any]]:
    data: list[dict[str, Any]] = load_fixture("exercise_templates")
    return data


@pytest.fixture
def routines() -> list[dict[str, Any]]:
    data: list[dict[str, Any]] = load_fixture("routines")
    return data
