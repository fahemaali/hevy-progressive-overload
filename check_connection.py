"""
Run with:  python check_connection.py
Confirms your Hevy API key works and shows how much workout history there is.
"""
from dotenv import load_dotenv

load_dotenv()

from backend.hevy_client import HevyClient

if __name__ == "__main__":
    client = HevyClient()
    print(f"Connected to Hevy. You have {client.get_workout_count()} logged workouts.")
