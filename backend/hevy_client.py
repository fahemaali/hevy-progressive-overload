"""
Thin wrapper around the Hevy public API (https://api.hevyapp.com/docs/).

Read-only: your logged workouts (the sets, weights and reps that progressive
overload is measured from), exercise templates (which carry the muscle groups),
and routines (what you plan to do next).

Privacy: Hevy also exposes personal data (profile, body measurements). This
client can only reach the endpoints in ALLOWED_PATHS, so that data is never
fetched, let alone shown.
"""

import os
from typing import Any

import requests

BASE_URL = "https://api.hevyapp.com/v1"
TIMEOUT_SECONDS = 30

ALLOWED_PATHS = frozenset(
    {
        "/workouts",
        "/workouts/count",
        "/workouts/events",
        "/exercise_templates",
        "/routines",
    }
)

JSON = dict[str, Any]


class HevyError(Exception):
    """Raised for configuration problems or failed calls to the Hevy API."""


class HevyClient:
    def __init__(self, api_key: str | None = None, session: requests.Session | None = None):
        self.api_key = api_key or os.environ.get("HEVY_API_KEY")
        if not self.api_key or self.api_key == "your_key_here":
            raise HevyError(
                "HEVY_API_KEY is not set. Copy .env.example to .env and add your real key "
                "from https://hevy.com/settings?developer"
            )
        self.session = session or requests.Session()
        self.session.headers.update({"api-key": self.api_key, "Accept": "application/json"})

    def _get(self, path: str, params: dict[str, Any] | None = None) -> JSON:
        if path not in ALLOWED_PATHS:
            raise HevyError(f"Refusing to call {path}: not an allowed Hevy endpoint.")
        resp = self.session.get(f"{BASE_URL}{path}", params=params, timeout=TIMEOUT_SECONDS)
        if resp.status_code == 401:
            raise HevyError("Hevy rejected the API key (401). Check the value in your .env file.")
        if resp.status_code == 429:
            raise HevyError("Hevy rate limit reached (429). Try again shortly.")
        resp.raise_for_status()
        data: JSON = resp.json()
        return data

    # --- Workouts -------------------------------------------------------------

    def get_workout_count(self) -> int:
        count: int = self._get("/workouts/count")["workout_count"]
        return count

    def get_all_workouts(self) -> list[JSON]:
        return self._paginate("/workouts", "workouts", page_size=10)

    def get_workout_events(self, since: str) -> list[JSON]:
        """Workouts updated or deleted since an ISO 8601 timestamp, for incremental sync.

        Each event is {"type": "updated", "workout": {...}} or {"type": "deleted", "id": ...}.
        """
        return self._paginate("/workouts/events", "events", page_size=10, since=since)

    # --- Exercise templates ---------------------------------------------------

    def get_all_exercise_templates(self) -> list[JSON]:
        return self._paginate("/exercise_templates", "exercise_templates", page_size=100)

    # --- Routines -------------------------------------------------------------

    def get_all_routines(self) -> list[JSON]:
        return self._paginate("/routines", "routines", page_size=10)

    # --- Shared pagination helper ---------------------------------------------

    def _paginate(self, path: str, list_key: str, page_size: int, **params: Any) -> list[JSON]:
        results: list[JSON] = []
        page = 1
        while True:
            data = self._get(path, {**params, "page": page, "pageSize": page_size})
            items = data.get(list_key, [])
            results.extend(items)
            if len(items) < page_size or page >= data.get("page_count", page):
                break
            page += 1
        return results
