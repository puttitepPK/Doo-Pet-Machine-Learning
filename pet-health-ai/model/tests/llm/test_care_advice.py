import json
import unittest
from itertools import product
from unittest.mock import patch

from model.llm.care_advice import OPTIONS, care_advice, requests
from .fixtures import FakeResponse
from .test_gemini_client import provider


class CareAdviceTests(unittest.TestCase):
    def test_missing_key_falls_back_for_every_label_without_network(self):
        for label, groups in OPTIONS.items():
            with self.subTest(label=label), patch("model.llm.gemini_client.urlopen") as opener:
                self.assertEqual(care_advice(label, api_key=""), {"items": [g[0] for g in groups], "source": "fallback"})
                opener.assert_not_called()

    def test_valid_choice_returns_only_approved_text(self):
        def opener(request, timeout):
            self.assertEqual(timeout, 7)
            body = json.loads(request.data)
            self.assertEqual(body["generationConfig"]["maxOutputTokens"], 256)
            self.assertEqual(body["generationConfig"]["responseMimeType"], "application/json")
            self.assertIn("ห้ามยืนยันโรค", body["contents"][0]["parts"][0]["text"])
            return FakeResponse(json.dumps(provider({"choice": 1})).encode())

        with patch("model.llm.care_advice.random.shuffle"):
            result = care_advice("dermatitis", api_key="k", opener=opener)
        self.assertEqual(result, {"items": list(list(product(*OPTIONS["dermatitis"]))[1]), "source": "gemini"})
        self.assertIsInstance(result["items"], list)

    def test_invalid_choices_and_responses_use_fallback(self):
        expected = {"items": [g[0] for g in OPTIONS["healthy"]], "source": "fallback"}
        for result in ({"choice": True}, {"choice": -1}, {"choice": 1000}, {"choice": "0"}, {}, []):
            with self.subTest(result=result):
                opener = lambda *a, **k: FakeResponse(json.dumps(provider(result)).encode())
                self.assertEqual(care_advice("healthy", api_key="k", opener=opener), expected)
        for raw in (b"not json", json.dumps(provider({}, "MAX_TOKENS")).encode()):
            self.assertEqual(care_advice("healthy", api_key="k", opener=lambda *a, **k: FakeResponse(raw)), expected)

    def test_network_failure_releases_concurrency_slot(self):
        with patch("model.llm.gemini_client.urlopen", side_effect=OSError("offline")):
            self.assertEqual(care_advice("healthy", api_key="k")["source"], "fallback")
        acquired = []
        try:
            for _ in range(2):
                self.assertTrue(requests.acquire(blocking=False))
                acquired.append(True)
        finally:
            for _ in acquired:
                requests.release()

    def test_busy_advice_service_returns_fallback_without_network(self):
        acquired = []
        try:
            for _ in range(2):
                self.assertTrue(requests.acquire(blocking=False))
                acquired.append(True)
            with patch("model.llm.gemini_client.urlopen") as opener:
                self.assertEqual(care_advice("healthy", api_key="k")["source"], "fallback")
                opener.assert_not_called()
        finally:
            for _ in acquired:
                requests.release()
