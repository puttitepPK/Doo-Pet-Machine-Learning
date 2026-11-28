"""Shared Gemini JSON transport; callers own validation and fallback policy."""
import json
import logging
from urllib.request import Request, urlopen

from .config import MODEL

logger = logging.getLogger(__name__)

def generate_json(body, *, api_key, timeout, opener=None):
    """Return parsed JSON, or None for an unfinished generation.

    Network/protocol/JSON errors propagate to each service's existing fallback.
    The key and prompt are never logged here. No retries are added.
    """
    request = Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent",
        data=json.dumps(body, ensure_ascii=False).encode(),
        headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
    )
    with (opener if opener is not None else urlopen)(request, timeout=timeout) as response:
        payload = json.load(response)
    if isinstance(payload, dict) and not payload.get("candidates"):
        logger.warning("Gemini provider response reason=no_candidates_or_blocked")
        raise ValueError("Missing Gemini candidates")
    candidate = payload["candidates"][0]
    if candidate.get("finishReason") != "STOP":
        finish = candidate.get("finishReason")
        safe_reason = finish if finish in ("MAX_TOKENS", "SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT") else "OTHER"
        logger.warning("Gemini provider response reason=unfinished finish_reason=%s", safe_reason)
        return None
    text = "".join(part.get("text", "") for part in candidate["content"]["parts"] if not part.get("thought"))
    return json.loads(text)
