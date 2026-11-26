import unittest

from model.llm.owner_context import OwnerContextError, normalize_owner_context
from .fixtures import FULL

class NormalizeTests(unittest.TestCase):
    def test_empty_inputs_become_null(self):
        for raw in (None, {}, {"version": 1}, {"symptoms": [], "notes": "   ", "duration": None}):
            self.assertIsNone(normalize_owner_context(raw))

    def test_full_context_is_canonical(self):
        self.assertEqual(normalize_owner_context(FULL), {
            "version": 1, "symptoms": ["itching", "redness"], "duration": "2_3_days", "body_sites": ["abdomen"],
            "living_environment": "both", "recent_changes": ["shampoo"], "notes": "เริ่มเกาหลังอาบน้ำ",
        })

    def test_partial_keeps_only_answered_fields(self):
        self.assertEqual(normalize_owner_context({"duration": "today"}), {"version": 1, "duration": "today"})

    def test_rejects_bad_values(self):
        bad = [
            {"symptoms": ["itching", "unsure"]}, {"recent_changes": ["none", "food"]}, {"recent_changes": ["unknown", "none"]},
            {"body_sites": ["multiple", "ears"]}, {"symptoms": "itching"}, {"symptoms": ["fever"]}, {"duration": ["today"]},
            {"duration": "forever"}, {"notes": 5}, {"notes": "ก" * 501}, {"version": 2, "duration": "today"},
            {"version": True, "duration": "today"}, {"extra": 1}, ["itching"],
        ]
        for raw in bad:
            with self.subTest(raw=raw), self.assertRaises(OwnerContextError):
                normalize_owner_context(raw)

    def test_notes_limit_and_control_chars(self):
        self.assertEqual(normalize_owner_context({"notes": "ก" * 500})["notes"], "ก" * 500)
        self.assertEqual(normalize_owner_context({"notes": "a\u202eb\u0000c\r\nd"})["notes"], "abc\nd")
        self.assertEqual(normalize_owner_context({"recent_changes": ["food", "food"]})["recent_changes"], ["food"])


