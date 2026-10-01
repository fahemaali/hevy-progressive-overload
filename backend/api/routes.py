"""The JSON API the frontend calls. Read-only: every route is a GET."""

from datetime import date

from flask import Blueprint, abort, current_app, request

from backend.api import responses
from backend.service import ProgressService, Snapshot

api = Blueprint("api", __name__, url_prefix="/api")

SEARCH_LIMIT = 20


def service() -> ProgressService:
    svc: ProgressService = current_app.extensions["progress_service"]
    return svc


def snapshot() -> Snapshot:
    snap = service().snapshot()
    if snap is None:
        abort(503, "Your Hevy data isn't available yet. Try again in a minute.")
    return snap


@api.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@api.get("/status")
def status() -> responses.StatusJSON:
    st = service().status()
    minutes = None
    if st.synced_at is not None:
        minutes = int((service().refresher.now() - st.synced_at).total_seconds() // 60)
    return {
        "has_data": st.synced_at is not None,
        "synced_minutes_ago": minutes,
        "refreshing": st.refreshing,
        "refresh_failed": st.last_error is not None,
    }


@api.get("/body-map")
def body_map() -> responses.BodyMapJSON:
    return responses.body_map_json(snapshot().muscles, service().today())


@api.get("/muscles/<group>")
def muscle(group: str) -> responses.MuscleJSON:
    if group not in responses.BODY_MUSCLES:
        abort(404, f"Unknown muscle group: {group}")
    return responses.muscle_json(group, snapshot().muscles.get(group), service().today())


@api.get("/exercises/<template_id>")
def exercise(template_id: str) -> responses.ExerciseJSON:
    snap = snapshot()
    progress = snap.progress.get(template_id)
    if progress is None or not progress.ranges:
        abort(404, "No tracked history for this exercise.")
    titles = {t.id: t.title for t in snap.templates.values()}
    return responses.exercise_json(progress, titles)


@api.get("/search")
def search() -> responses.SearchJSON:
    """Tracked exercises you've done and body muscles matching every word of `q`,
    most recently trained first. An empty query lists your most recent exercises."""
    snap = snapshot()
    words = request.args.get("q", "").lower().split()

    def matches(text: str) -> bool:
        text = text.lower().replace("_", " ")
        return all(word in text for word in words)

    exercises = sorted(
        (p for p in snap.progress.values() if p.ranges and matches(p.template.title)),
        key=lambda p: p.last_trained or date.min,
        reverse=True,
    )
    muscles = [g for g in responses.BODY_MUSCLES if words and matches(g)]
    return {
        "exercises": [responses.exercise_hit_json(p) for p in exercises[:SEARCH_LIMIT]],
        "muscles": [{"group": g, "label": responses.muscle_label(g)} for g in muscles],
    }
