"""Shared Gemini JSON transport; callers own validation and fallback policy."""
import json
from urllib.request import Request, urlopen

from .config import MODEL


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
        candidate = json.load(response)["candidates"][0]
    if candidate.get("finishReason") != "STOP":
        return None
    text = "".join(part.get("text", "") for part in candidate["content"]["parts"] if not part.get("thought"))
    return json.loads(text)
