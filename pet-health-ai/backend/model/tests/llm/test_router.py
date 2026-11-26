import json
import unittest
from unittest.mock import patch
from urllib.parse import urlencode

from fastapi import FastAPI
from model.llm.router import router


class RouterTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.app = FastAPI()
        self.app.include_router(router)
        self.env = patch.dict("os.environ", {"GEMINI_API_KEY": ""})
        self.env.start()
        self.addCleanup(self.env.stop)

    async def request(self, method, *, query=None, body=None):
        messages = []
        raw = json.dumps(body).encode() if body is not None else b""
        scope = {"type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1", "scheme": "http",
                 "method": method, "path": "/care-advice", "raw_path": b"/care-advice", "root_path": "",
                 "query_string": urlencode(query or {}).encode(), "headers": [(b"content-type", b"application/json")],
                 "client": ("127.0.0.1", 1234), "server": ("testserver", 80)}

        async def receive():
            return {"type": "http.request", "body": raw, "more_body": False}

        async def send(message):
            messages.append(message)

        await self.app(scope, receive, send)
        status = next(m["status"] for m in messages if m["type"] == "http.response.start")
        data = json.loads(b"".join(m.get("body", b"") for m in messages if m["type"] == "http.response.body"))
        return status, data

    async def test_get_contract(self):
        status, data = await self.request("GET", query={"label": "healthy"})
        self.assertEqual(status, 200)
        self.assertEqual(set(data), {"items", "source"})
        self.assertEqual(len(data["items"]), 3)
        self.assertEqual(data["source"], "fallback")

    async def test_post_normalizes_context_and_keeps_response_shape(self):
        with patch("model.llm.router.advice_with_context", return_value={"items": ["a", "b", "c"], "source": "gemini", "owner_context": {"version": 1, "symptoms": ["itching"]}, "context_tips": {"items": ["จดอาการ"], "source": "fallback"}}) as service:
            status, data = await self.request("POST", body={"label": "dermatitis", "score": 0.8, "owner_context": {"symptoms": ["itching", "itching"]}})
            service.assert_called_once_with("dermatitis", 0.8, {"version": 1, "symptoms": ["itching"]})
        self.assertEqual(status, 200)
        self.assertEqual(set(data), {"items", "source", "owner_context", "context_tips"})

    async def test_post_without_context_keeps_null_fields(self):
        status, data = await self.request("POST", body={"label": "healthy"})
        self.assertEqual(status, 200)
        self.assertIsNone(data["owner_context"])
        self.assertIsNone(data["context_tips"])

    async def test_post_context_fallback_is_available_without_provider(self):
        status, data = await self.request("POST", body={"label": "healthy", "score": 0, "owner_context": {"symptoms": ["itching"]}})
        self.assertEqual(status, 200)
        self.assertEqual(data["context_tips"]["source"], "fallback")

    async def test_invalid_labels_keep_422(self):
        for method in ("GET", "POST"):
            with self.subTest(method=method):
                status, data = await self.request(method, query={"label": "unknown"}, body={"label": "unknown"} if method == "POST" else None)
                self.assertEqual(status, 422)
                self.assertEqual(data["detail"], "ไม่พบกลุ่มผลคัดกรอง")

    async def test_bad_scores_or_context_do_not_call_service(self):
        cases = [{"label": "healthy", "score": score} for score in (True, "0.8", -1, 1.1)]
        cases += [{"label": "healthy", "owner_context": {"symptoms": ["itching", "unsure"]}}, {}, ["healthy"]]
        for payload in cases:
            with self.subTest(payload=payload), patch("model.llm.router.advice_with_context") as service:
                status, _ = await self.request("POST", body=payload)
                self.assertEqual(status, 422)
                service.assert_not_called()
