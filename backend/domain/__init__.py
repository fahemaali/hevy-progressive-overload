"""
The app's core logic: turning logged workouts into progress verdicts and suggestions.

Everything here is pure: plain data in, plain data out, no network, database or
clock. That keeps the rules easy to read and easy to test exhaustively.
The rules themselves are documented in REQUIREMENTS.md.
"""
