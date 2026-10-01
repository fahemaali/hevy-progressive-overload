"""
Local development server. Run with:  python run.py
Then open http://127.0.0.1:5050 in your browser.

Port 5050, not Flask's default 5000: on macOS, 5000 is claimed by the system
AirPlay Receiver. Set PORT to use another (hosting platforms set it themselves).
"""

import os

from dotenv import load_dotenv

load_dotenv()

from backend.app import create_app

app = create_app()

if __name__ == "__main__":
    app.run(debug=True, port=int(os.environ.get("PORT", 5050)))
