import unittest
from unittest.mock import Mock, call, patch

from model.llm.service import advice_with_context, general_advice


class ServiceTests(unittest.TestCase):
    def test_general_advice_does_not_request_context_tips(self):
        advice = {"items": ["a", "b", "c"], "source": "fallback"}
        with patch("model.llm.service.care_advice", return_value=advice) as general, patch("model.llm.service.context_tips") as tips:
            self.assertIs(general_advice("healthy"), advice)
            general.assert_called_once_with("healthy")
            tips.assert_not_called()

    def test_combined_advice_preserves_call_order_scores_and_input(self):
        context = {"version": 1, "symptoms": ["itching"]}
        advice = {"items": ["a", "b", "c"], "source": "gemini"}
        tips = {"items": ["จดอาการ"], "source": "fallback"}
        calls = Mock()
        with patch("model.llm.service.care_advice", return_value=advice) as general, patch("model.llm.service.context_tips", return_value=tips) as extra:
            calls.attach_mock(general, "general")
            calls.attach_mock(extra, "tips")
            result = advice_with_context("healthy", 0.9, context)
        self.assertEqual(calls.mock_calls, [call.general("healthy"), call.tips("healthy", 0.9, context)])
        self.assertEqual(result, {**advice, "owner_context": context, "context_tips": tips})
        self.assertEqual(context, {"version": 1, "symptoms": ["itching"]})
        self.assertEqual(set(advice), {"items", "source"})
