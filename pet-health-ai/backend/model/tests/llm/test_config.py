import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import call, patch

from model.llm.config import get_api_key, load_environment


class ConfigTests(unittest.TestCase):
    def test_env_paths_and_precedence_are_preserved(self):
        model_dir = Path(__file__).resolve().parents[2]
        with patch("dotenv.load_dotenv") as load:
            load_environment()
        self.assertEqual(load.call_args_list, [call(model_dir.parent / ".env.local", override=False), call(model_dir / ".env.local", override=False)])

    def test_key_override_empty_and_process_environment(self):
        with patch.dict("os.environ", {"GEMINI_API_KEY": " fake-process-key "}):
            self.assertEqual(get_api_key(), "fake-process-key")
            self.assertEqual(get_api_key(""), "")
            self.assertEqual(get_api_key(" override "), "override")

    def test_package_and_script_imports_do_not_load_env_or_image_models(self):
        model_dir = Path(__file__).resolve().parents[2]
        for cwd, module in ((model_dir.parent, "model.llm.router"), (model_dir, "llm.router")):
            with self.subTest(module=module):
                code = ("import sys; from unittest.mock import patch; "
                        "guard=patch('dotenv.load_dotenv',side_effect=AssertionError('env loaded at import')); guard.start(); "
                        f"import {module}; "
                        "assert not any(name in sys.modules for name in ('torch','torchvision','transformers','model.main','main'))")
                result = subprocess.run([sys.executable, "-c", code], cwd=cwd, capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stderr)
