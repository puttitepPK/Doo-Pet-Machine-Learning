import io
import json

class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


def gemini(tips, finish="STOP"):
    body = {"candidates": [{"finishReason": finish, "content": {"parts": [{"text": json.dumps({"tips": tips}, ensure_ascii=False)}]}}]}
    sent = {}

    def opener(request, timeout):
        sent["body"] = json.loads(request.data.decode())
        return FakeResponse(json.dumps(body).encode())
    return opener, sent


FULL = {
    "version": 1, "symptoms": ["redness", "itching"], "duration": "2_3_days", "body_sites": ["abdomen"],
    "living_environment": "both", "recent_changes": ["shampoo"], "notes": "  เริ่มเกาหลังอาบน้ำ  ",
}


