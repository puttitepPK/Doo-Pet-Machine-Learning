"""Check paired TTA evaluation and the notebook's embedded inference code offline."""

import ast
import copy
import json
from pathlib import Path
import unittest

import numpy as np
import pandas as pd
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
import torch
from torch.utils.data import DataLoader, TensorDataset
from torchvision import models
from sklearn.metrics import accuracy_score, classification_report, f1_score
from tqdm.auto import tqdm

from model.b3.b3_inference import build_b3_batch, get_b3_tta_default
from model.b3.tta_evaluation import collect_tta_pairs, select_tta_metadata, summarize_tta_scores


class DirectionalClassifier(torch.nn.Module):
    def __init__(self):
        super().__init__()
        self.scale = torch.nn.Parameter(torch.tensor(1.0))

    def forward(self, images):
        left = images[:, 0, 0, 0] * self.scale
        right = images[:, 0, 0, -1] * self.scale
        return torch.stack([left * 3, right * 2, left - right,
                            right - left, left * 0, right * 0], dim=1)


NAMES = ["bacterial_dermatosis", "demodicosis", "dermatitis",
         "fungal_infection", "healthy", "hypersensitivity"]


class TTAEvaluationTests(unittest.TestCase):
    def test_paired_evaluation_keeps_image_order_and_averages_probabilities(self):
        images = torch.zeros(3, 6, 3, 5, 7)
        for sample in range(3):
            for view in range(6):
                images[sample, view, 0, 0, 0] = (sample + view) / 6
                images[sample, view, 0, 0, -1] = (6 - view) / 6
        labels = torch.tensor([0, 1, 2])
        model = DirectionalClassifier()
        before = model.scale.detach().clone()
        single, paired, targets = collect_tta_pairs(
            model, DataLoader(TensorDataset(images, labels), batch_size=2), torch.device("cpu"), 6)
        with torch.inference_mode():
            per_view = torch.stack([torch.softmax(model(images[:, view]), dim=1) for view in range(6)])
            expected_single = per_view[0]
        np.testing.assert_allclose(single, expected_single.numpy(), atol=1e-7)
        np.testing.assert_allclose(paired, per_view.mean(dim=0).numpy(), atol=1e-7)
        self.assertEqual(targets.tolist(), [0, 1, 2])
        torch.testing.assert_close(before, model.scale, rtol=0, atol=0)
        self.assertFalse(model.training)
        self.assertIsNone(model.scale.grad)

    def test_validation_selection_and_api_metadata_agree_and_keep_historical_tta_false(self):
        base = {"dataset": {"split_counts": {"val": 2}, "split_sha256": "split"},
                "preprocessing": {"tta": False}, "weights_sha256": "weights"}
        single = {"images": 2, "macro_f1": 0.70}
        tta = {"images": 2, "macro_f1": 0.71}
        result = select_tta_metadata(base, single, tta, "weights", "split")
        self.assertTrue(get_b3_tta_default(result))
        self.assertFalse(result["preprocessing"]["tta"])
        self.assertNotIn("inference", base)
        tied = select_tta_metadata(base, single, single, "weights", "split")
        self.assertFalse(get_b3_tta_default(tied))
        for args in [(base, single, tta, "other", "split"),
                     (base, single, tta, "weights", "other"),
                     (base, {"images": 3, "macro_f1": 0.7}, tta, "weights", "split")]:
            with self.assertRaises(ValueError):
                select_tta_metadata(*args)

    def test_summary_detects_high_confidence_errors_and_has_only_six_class_rows(self):
        scores = np.eye(6, dtype=float)[[0, 1, 3]] * 0.98 + 0.02 / 6
        metrics, report = summarize_tta_scores(np.array([0, 2, 3]), scores, NAMES)
        self.assertEqual(metrics["errors"], 1)
        self.assertEqual(metrics["errors_with_score_at_least_95pct"], 1)
        self.assertEqual(set(report), set(NAMES))
        with self.assertRaises(ValueError):
            summarize_tta_scores(np.array([0, 2, 3]), scores * 2, NAMES)

    def test_notebook_code_compiles_and_embedded_functions_match_shared_evaluation(self):
        notebook_path = Path(__file__).resolve().parents[1] / "DL_EfficientNet_B3_Model.ipynb"
        notebook = json.loads(notebook_path.read_text(encoding="utf-8"))
        namespace = dict(np=np, pd=pd, torch=torch, copy=copy, tqdm=tqdm,
                         accuracy_score=accuracy_score, classification_report=classification_report,
                         f1_score=f1_score, Image=Image, ImageOps=ImageOps,
                         ImageEnhance=ImageEnhance, ImageFilter=ImageFilter, CLASS_NAMES=NAMES,
                         THAI_NAMES={name: name for name in NAMES},
                         eval_transform=models.EfficientNet_B3_Weights.DEFAULT.transforms())
        allowed = {"collect_tta_pairs", "summarize_tta_scores", "select_tta_metadata", "predict_pil",
                   "enhance_b3_image", "build_b3_views", "build_b3_batch"}
        found = set()
        for index, cell in enumerate(notebook["cells"]):
            if cell["cell_type"] != "code":
                continue
            tree = ast.parse("".join(cell["source"]), filename=f"cell_{index}")
            definitions = [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name in allowed]
            found.update(node.name for node in definitions)
            if definitions:
                exec(compile(ast.Module(body=definitions, type_ignores=[]), "notebook", "exec"), namespace)
        self.assertEqual(found, allowed)
        images, labels = torch.randn(2, 6, 3, 5, 7), torch.tensor([0, 1])
        loader = DataLoader(TensorDataset(images, labels), batch_size=2)
        original = collect_tta_pairs(DirectionalClassifier(), loader, torch.device("cpu"), 6)
        embedded = namespace["collect_tta_pairs"](DirectionalClassifier(), loader, torch.device("cpu"), 6)
        for expected, actual in zip(original, embedded):
            np.testing.assert_allclose(expected, actual, atol=1e-7)
        image = Image.new("RGB", (460, 350), (20, 80, 130))
        image.paste((210, 20, 60), (0, 0, 150, 350))
        model = DirectionalClassifier().eval()
        scores = namespace["predict_pil"](model, image, use_tta=True)
        batch = build_b3_batch(image, namespace["eval_transform"], torch.device("cpu"), use_tta=True)
        with torch.inference_mode():
            expected = torch.softmax(model(batch), dim=1).mean(dim=0).numpy()
        actual = scores.set_index("class").loc[NAMES, "score"].to_numpy()
        np.testing.assert_allclose(actual, expected, atol=1e-7)


if __name__ == "__main__":
    unittest.main()
