import json
import unittest
from unittest.mock import patch

from model.llm.config import MODEL
from model.llm.gemini_client import generate_json
from .fixtures import FakeResponse


def provider(payload, finish="STOP"):
    return {"candidates": [{"finishReason": finish, "content": {"parts": [
        {"thought": True, "text": "ignored"}, {"text": json.dumps(payload, ensure_ascii=False)},
    ]}}]}


class GeminiClientTests(unittest.TestCase):
    def test_request_and_response_contract(self):
        body = {"contents": [{"parts": [{"text": "ข้อความทดสอบ"}]}]}

        def opener(request, timeout):
            self.assertEqual(request.full_url, f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent")
            self.assertEqual(request.get_method(), "POST")
            self.assertEqual(request.get_header("X-goog-api-key"), "fake-key")
            self.assertEqual(request.get_header("Content-type"), "application/json")
            self.assertEqual(timeout, 7)
            self.assertEqual(json.loads(request.data), body)
            return FakeResponse(json.dumps(provider({"choice": 1})).encode())

        self.assertEqual(generate_json(body, api_key="fake-key", timeout=7, opener=opener), {"choice": 1})

    def test_non_stop_results_are_not_used(self):
        for finish in ("MAX_TOKENS", "SAFETY", None):
            with self.subTest(finish=finish):
                result = generate_json({}, api_key="k", timeout=8, opener=lambda *a, **k: FakeResponse(json.dumps(provider({}, finish)).encode()))
                self.assertIsNone(result)

    def test_invalid_provider_payload_propagates_to_service_fallback(self):
        for raw in (b"not json", b'{}', b'{"candidates": []}', json.dumps(provider("not an object")).encode()):
            with self.subTest(raw=raw):
                if raw == json.dumps(provider("not an object")).encode():
                    self.assertEqual(generate_json({}, api_key="k", timeout=8, opener=lambda *a, **k: FakeResponse(raw)), "not an object")
                else:
                    with self.assertRaises((ValueError, KeyError, IndexError, TypeError)):
                        generate_json({}, api_key="k", timeout=8, opener=lambda *a, **k: FakeResponse(raw))

    def test_default_transport_is_resolved_at_call_time(self):
        with patch("model.llm.gemini_client.urlopen", return_value=FakeResponse(json.dumps(provider({"choice": 0})).encode())) as opener:
            self.assertEqual(generate_json({}, api_key="k", timeout=7), {"choice": 0})
            self.assertEqual(opener.call_count, 1)

    def test_network_failure_propagates_without_retry(self):
        with patch("model.llm.gemini_client.urlopen", side_effect=OSError("offline")) as opener:
            with self.assertRaises(OSError):
                generate_json({}, api_key="k", timeout=7)
            self.assertEqual(opener.call_count, 1)
