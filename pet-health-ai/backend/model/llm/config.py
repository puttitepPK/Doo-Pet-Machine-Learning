"""LLM settings and explicit environment bootstrap (no import-time loading)."""
import os
from pathlib import Path

MODEL = "gemini-3.5-flash-lite"
ADVICE_TIMEOUT = 7
CONTEXT_TIMEOUT = 8
ADVICE_CONCURRENCY = 2
MAX_TIPS = 3
TIP_MAX = 220


def load_environment():
    """Keep process env > backend/.env.local > model/.env.local."""
    from dotenv import load_dotenv

    model_dir = Path(__file__).resolve().parents[1]
    load_dotenv(model_dir.parent / ".env.local", override=False)
    load_dotenv(model_dir / ".env.local", override=False)


def get_api_key(override=None):
    return (override if override is not None else os.environ.get("GEMINI_API_KEY", "")).strip()
