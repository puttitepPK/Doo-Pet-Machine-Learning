import unittest
from unittest.mock import patch

from model.llm.service import advice_with_context, general_advice


class ServiceTests(unittest.TestCase):
    def test_general_advice_does_not_request_context_tips(self):
        advice = {"items": ["a", "b", "c"], "source": "fallback"}
        with patch("model.llm.service.care_advice", return_value=advice) as general:
            self.assertIs(general_advice("healthy"), advice)
            general.assert_called_once_with("healthy")

    def test_combined_advice_uses_one_call_and_preserves_scores_and_input(self):
        context = {"version": 1, "symptoms": ["itching"]}
        advice = {"items": ["a", "b", "c"], "source": "gemini"}
        tips = {"items": ["จดอาการ"], "source": "fallback"}
        with patch("model.llm.service.care_advice", return_value={**advice, "context_tips": tips}) as general:
            result = advice_with_context("healthy", 0.9, context)
        general.assert_called_once_with("healthy", score=0.9, context=context)
        self.assertEqual(result, {**advice, "owner_context": context, "context_tips": tips})
        self.assertEqual(context, {"version": 1, "symptoms": ["itching"]})
        self.assertEqual(set(advice), {"items", "source"})
