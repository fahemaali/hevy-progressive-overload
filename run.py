"""
Entry point. Run with:  python run.py
Then open http://127.0.0.1:5050 in your browser.

Port 5050, not Flask's default 5000 — on macOS, 5000 is claimed by the
system AirPlay Receiver (ControlCenter), which silently blocks the app from
binding to it.
"""
from dotenv import load_dotenv

load_dotenv()

from backend.app import create_app

app = create_app()

if __name__ == "__main__":
    app.run(debug=True, port=5050)
