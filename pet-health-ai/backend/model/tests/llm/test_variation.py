import json
import unittest
from io import StringIO
from unittest.mock import patch
from urllib.error import HTTPError

from model.llm.care_advice import OPTIONS, care_advice
from model.llm.prompts import build_advice_prompt
from model.llm.service import log_advice
from model.llm.variation import STYLES, normalize_previous, repeats
from .fixtures import FakeResponse
from .test_gemini_client import provider


ITEMS = ["สังเกตว่ารอยแดงขยายกว้างขึ้นกว่าเดิมหรือไม่", "ลดการเลียเกา หากเจ็บควรพบสัตวแพทย์", "หลีกเลี่ยงการขัดถูผิวหนัง"]
REWRITTEN = ["ลองดูผิวหนังทุกวันว่ามีรอยแดงลามหรือไม่", "ดูแลบริเวณระคายเคืองโดยลดการเกา หากเจ็บควรพบสัตวแพทย์", "งดถูแรงบริเวณผิวที่แดง"]


class VariationTests(unittest.TestCase):
    def test_guidelines_styles_and_previous_are_data_not_image_results(self):
        previous = {"items": ITEMS}
        prompts = [build_advice_prompt('dermatitis', 0.8, None, guidelines=OPTIONS['dermatitis'], style=style, previous=previous) for style in STYLES[:3]]
        self.assertEqual(len(set(prompts)), 3)
        data = json.loads(prompts[0].split('ข้อมูล (JSON):\n')[1])
        self.assertEqual(data['reference_guidelines'], [list(g) for g in OPTIONS['dermatitis']])
        self.assertEqual(data['image_result'], {'label': 'dermatitis', 'model_score': 0.8})
        self.assertEqual(data['previous_advice'], previous)

    def test_duplicate_response_is_rewritten_once(self):
        calls = []
        def opener(request, timeout):
            calls.append(json.loads(request.data))
            return FakeResponse(json.dumps(provider({'items': ITEMS if len(calls) == 1 else REWRITTEN})).encode())
        result = care_advice('dermatitis', previous={'items': ITEMS}, api_key='secret', opener=opener)
        self.assertEqual(result['source'], 'gemini')
        self.assertEqual(result['items'], REWRITTEN)
        self.assertEqual(len(calls), 2)
        self.assertEqual(len(calls[1]['contents']), 3)

    def test_persistent_duplicate_uses_fallback(self):
        with patch('model.llm.care_advice.generate_json', return_value={'items': ITEMS}) as generate:
            result = care_advice('dermatitis', previous={'items': ITEMS}, api_key='secret')
        self.assertEqual(generate.call_count, 2)
        self.assertEqual(result['source'], 'fallback')

    def test_tips_cannot_repeat_main_advice(self):
        with patch('model.llm.care_advice.generate_json', return_value={'items': ITEMS, 'tips': [ITEMS[0]]}):
            result = care_advice('dermatitis', context={'symptoms': ['itching']}, api_key='secret')
        self.assertEqual(result['source'], 'gemini')
        self.assertEqual(result['context_tips']['source'], 'fallback')

    def test_failed_rewrite_keeps_successful_main_advice(self):
        with patch('model.llm.care_advice.generate_json', side_effect=[{'items': ITEMS, 'tips': [ITEMS[0]]}, OSError('offline')]):
            result = care_advice('dermatitis', context={'symptoms': ['itching']}, api_key='secret')
        self.assertEqual(result['items'], ITEMS)
        self.assertEqual(result['source'], 'gemini')
        self.assertEqual(result['context_tips']['source'], 'fallback')

    def test_whitespace_changes_and_reused_openings_are_detected(self):
        self.assertTrue(repeats(['  ' + ITEMS[0] + '  '], ITEMS))
        self.assertTrue(repeats([ITEMS[0][:30] + ' และมีจุดใหม่ไหม'], ITEMS))
        self.assertFalse(repeats(REWRITTEN, ITEMS))

    def test_previous_validation(self):
        self.assertEqual(normalize_previous({'items': ITEMS}), {'items': ITEMS})
        for raw in ([], {'items': ['x']}, {'items': ['x' * 221] * 3}, {'notes': 'private'}, {'tips': []}):
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                normalize_previous(raw)

    def test_diagnostics_classify_failures_without_secrets(self):
        for failure, category in ((HTTPError('https://secret.invalid', 403, 'private-owner-text', None, None), 'provider'),
                                  (OSError('private-owner-text'), 'provider'), (ValueError('private-owner-text'), 'response')):
            with patch('model.llm.care_advice.generate_json', side_effect=failure):
                with self.assertLogs('model.llm.care_advice', level='WARNING') as logs:
                    care_advice('healthy', context={'notes': 'private-owner-text'}, api_key='secret-key')
            output = '\n'.join(logs.output)
            self.assertIn('category=' + category, output)
            self.assertNotIn('private-owner-text', output)
            self.assertNotIn('secret-key', output)
        with self.assertLogs('model.llm.care_advice', level='WARNING') as logs:
            care_advice('healthy', api_key='')
        self.assertIn('category=configuration reason=missing_api_key', logs.output[0])

    def test_private_terminal_log_does_not_echo_owner_related_advice(self):
        with patch('sys.stdout', new_callable=StringIO) as output:
            log_advice('healthy', {'items': ['private-owner-text'] * 3, 'source': 'gemini'}, private=True)
        self.assertIn('Gemini', output.getvalue())
        self.assertNotIn('private-owner-text', output.getvalue())
