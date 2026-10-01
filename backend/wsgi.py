"""
Production entry point, for gunicorn:

    gunicorn --workers 1 --threads 8 backend.wsgi:app

One worker on purpose: the background refresh from Hevy is coordinated inside a
single process, so more workers would each refresh on their own. Threads handle
concurrent requests within it.
"""

import logging

from dotenv import load_dotenv

load_dotenv()

from backend.app import create_app

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

app = create_app()
