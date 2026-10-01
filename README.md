# Hevy Progressive Overload

A personal training dashboard built on top of my [Hevy](https://www.hevyapp.com/) workout
data. It answers one question, muscle group by muscle group: **am I actually progressively
overloading?** — and tells me what to do this week to keep it going.

> Built with generative AI (Claude Code) as a showcase project.
> Not affiliated with or endorsed by Hevy.

## What it does (planned)

- **Organised by muscle group** — e.g. open *Triceps* and see every exercise that trains them.
- **Looks back** — for exercises I repeat, shows whether weight, reps and volume have been
  going up over time.
- **Looks ahead** — suggests this week's target for each exercise: either *add weight* at a
  given rep count, or *keep/reduce weight and add reps* — both counted as overload.
- **Estimated 1-rep max, front and centre** — tracked per exercise and rolled up per muscle
  group, with green ▲ / red ▼ indicators so progress (or the lack of it) is obvious at a glance.

See [REQUIREMENTS.md](REQUIREMENTS.md) for the detail.

## Setup

```bash
# 1. Create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Add your Hevy API key (needs Hevy Pro)
cp .env.example .env
# then open .env and paste your key from https://hevy.com/settings?developer

# 4. Check the connection, then copy your data locally
python check_connection.py
python -m backend.sync

# 5. Run the app
python run.py
```

Then open http://127.0.0.1:5050.

## Development

```bash
pip install -r requirements-dev.txt

pytest            # tests (run on synthetic data in tests/fixtures, no API key needed)
ruff check .      # lint
ruff format .     # format
mypy              # type check
```

CI runs all of these on every push and pull request.

### How data flows

1. `python -m backend.sync` (and the app itself, every 15 minutes while in use) copies your Hevy
   data into a local SQLite file, `data/hevy.db`. The first sync copies everything; later ones
   only fetch workouts changed or deleted since the last sync.
2. Only what the app needs is stored: notes, descriptions and training times are dropped before
   anything is saved. The file is git-ignored and safe to delete; the next sync rebuilds it.
3. The app reads from that copy, so visitors never trigger calls to Hevy.
