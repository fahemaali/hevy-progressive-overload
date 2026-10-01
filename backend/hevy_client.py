"""
Thin wrapper around the Hevy public API (https://api.hevyapp.com/docs/).

Read-only: your logged workouts (the sets, weights and reps that progressive
overload is measured from), exercise templates (which carry the muscle groups),
and routines (what you plan to do next).
"""
import os
import requests

BASE_URL = "https://api.hevyapp.com/v1"


class HevyClient:
    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or os.environ.get("HEVY_API_KEY")
        if not self.api_key or self.api_key == "your_key_here":
            raise ValueError(
                "HEVY_API_KEY is not set. Copy .env.example to .env and add your real key "
                "from https://hevy.com/settings?developer"
            )

    @property
    def headers(self) -> dict:
        return {"api-key": self.api_key, "Content-Type": "application/json"}

    def _get(self, path: str, params: dict | None = None) -> dict:
        resp = requests.get(f"{BASE_URL}{path}", headers=self.headers, params=params, timeout=30)
        if resp.status_code == 401:
            raise ValueError("Hevy rejected the API key (401). Check the value in your .env file.")
        resp.raise_for_status()
        return resp.json()

    # --- Workouts -------------------------------------------------------------

    def get_workout_count(self) -> int:
        return self._get("/workouts/count")["workout_count"]

    def get_all_workouts(self) -> list[dict]:
        return self._paginate("/workouts", "workouts", page_size=10)

    # --- Exercise templates -------------------------------------------------

    def get_all_exercise_templates(self) -> list[dict]:
        return self._paginate("/exercise_templates", "exercise_templates", page_size=100)

    # --- Routines -------------------------------------------------------------

    def get_all_routines(self) -> list[dict]:
        return self._paginate("/routines", "routines", page_size=10)

    # --- Shared pagination helper -----------------------------------------

    def _paginate(self, path: str, list_key: str, page_size: int) -> list[dict]:
        results = []
        page = 1
        while True:
            data = self._get(path, {"page": page, "pageSize": page_size})
            items = data.get(list_key, [])
            results.extend(items)
            if len(items) < page_size or page >= data.get("page_count", page):
                break
            page += 1
        return results
