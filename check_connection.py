"""
Run with:  python check_connection.py
Confirms your Hevy API key works and shows how much workout history there is.
"""

import sys

from dotenv import load_dotenv

load_dotenv()

from backend.hevy_client import HevyClient, HevyError

if __name__ == "__main__":
    try:
        count = HevyClient().get_workout_count()
    except HevyError as err:
        sys.exit(f"Could not connect to Hevy: {err}")
    print(f"Connected to Hevy. You have {count} logged workouts.")
