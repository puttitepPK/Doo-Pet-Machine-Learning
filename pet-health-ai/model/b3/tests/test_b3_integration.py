"""Offline integration checks; CLIP screening is stubbed, disease accuracy is not measured."""

import hashlib
import contextlib
import importlib
import io
import json
import os
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch

os.environ.setdefault("OMP_NUM_THREADS", "2")
os.environ.setdefault("MKL_NUM_THREADS", "2")

import torch
from fastapi.testclient import TestClient
from PIL import Image, ImageOps
from torchvision import models

from model.b3.b3_inference import build_b3_batch, get_b3_tta_default, load_b3_model


MODEL_DIR = Path(__file__).resolve().parents[1]
CLASSES = ["bacterial_dermatosis", "demodicosis", "dermatitis",
           "fungal_infection", "healthy", "hypersensitivity"]


class B3IntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)
        # Import the real API with real local classifier weights, without contacting Hugging Face.
        fake_transformers = types.ModuleType("transformers")
        fake_transformers.CLIPModel = types.SimpleNamespace(
            from_pretrained=lambda *_args, **_kwargs: torch.nn.Identity())
        fake_transformers.CLIPProcessor = types.SimpleNamespace(
            from_pretrained=lambda *_args, **_kwargs: object())
        with patch.dict(sys.modules, {"transformers": fake_transformers}):
            cls.api = importlib.import_module("model.main")
        cls.client = TestClient(cls.api.app)
        cls.metadata = json.loads((MODEL_DIR / "efficientnet_b3_metadata.json").read_text(encoding="utf-8"))
        cls.image = Image.new("RGB", (460, 350), (130, 90, 55))
        content = io.BytesIO()
        cls.image.save(content, format="PNG")
        cls.image_bytes = content.getvalue()

    def post(self, route):
        with patch.object(self.api, "check_is_dog_or_lesion", return_value=True), contextlib.redirect_stdout(io.StringIO()):
            return self.client.post(route, files={"image": ("fixture.png", self.image_bytes, "image/png")})

    def assert_prediction(self, response):
        self.assertEqual(response.status_code, 200, response.text)
        values = response.json()
        self.assertEqual({row["label"] for row in values}, set(CLASSES))
        self.assertEqual([row["score"] for row in values], sorted(
            [row["score"] for row in values], reverse=True))
        self.assertAlmostEqual(sum(row["score"] for row in values), 1.0, delta=0.0005)
        return values

    def test_preprocessing_matches_colab_on_portrait_landscape_and_exif(self):
        reference = models.EfficientNet_B3_Weights.DEFAULT.transforms()
        for size in [(460, 350), (200, 440)]:
            image = Image.new("RGB", size)
            pixels = image.load()
            for x in range(size[0]):
                for y in range(size[1]):
                    pixels[x, y] = (x % 256, y % 256, (x + y) % 256)
            image.getexif()[274] = 6
            expected = reference(ImageOps.exif_transpose(image).convert("RGB")).unsqueeze(0)
            actual = build_b3_batch(image, self.api.b3_transforms, torch.device("cpu"))
            self.assertEqual(tuple(actual.shape), (1, 3, 300, 300))
            torch.testing.assert_close(actual, expected, rtol=0, atol=0)

    def test_metadata_rejects_class_order_and_wrong_checkpoint_hash(self):
        for invalid in [
            {**self.metadata, "class_names": list(reversed(CLASSES))},
            {**self.metadata, "weights_sha256": "0" * 64},
        ]:
            with patch.object(Path, "read_text", return_value=json.dumps(invalid)):
                with self.assertRaises(ValueError):
                    load_b3_model(MODEL_DIR, torch.device("cpu"), CLASSES)

    def test_status_has_all_three_models_and_b3_default(self):
        response = self.client.get("/models")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["default_model"], "efficientnet_b3")
        self.assertEqual(response.json()["available"], {
            "mobilenet": True, "efficientnet": True, "efficientnet_b3": True,
        })

    def test_auto_and_explicit_b3_match_direct_notebook_inference(self):
        batch = build_b3_batch(self.image, self.api.b3_transforms, self.api.device,
                               use_tta=self.api.b3_default_tta)
        with torch.inference_mode():
            scores = torch.softmax(self.api.model_efficientnet_b3(batch).float(), dim=1).mean(dim=0).tolist()
        expected = {name: round(score, 4) for name, score in zip(CLASSES, scores)}
        for route in ["/predict", "/predict?model_type=efficientnet_b3"]:
            values = self.assert_prediction(self.post(route))
            self.assertEqual({row["label"]: row["score"] for row in values}, expected)

    def test_tta_views_and_api_average_probabilities_without_changing_weights(self):
        image = self.image.copy()
        image.paste((210, 20, 80), (0, 0, 130, 350))
        batch = build_b3_batch(image, self.api.b3_transforms, self.api.device, use_tta=True)
        self.assertEqual(tuple(batch.shape), (6, 3, 300, 300))
        with patch.object(self.api, "inference_transforms", self.api.b3_transforms):
            b0_views_with_b3_preprocessing = self.api.build_tta_batch(image)
        torch.testing.assert_close(batch, b0_views_with_b3_preprocessing, rtol=0, atol=0)
        model = self.api.model_efficientnet_b3
        with torch.inference_mode():
            per_view = [torch.softmax(model(view.unsqueeze(0)).float(), dim=1)[0] for view in batch]
            expected_scores = torch.stack(per_view).mean(dim=0).tolist()
        expected = {name: round(score, 4) for name, score in zip(CLASSES, expected_scores)}
        content = io.BytesIO()
        image.save(content, format="PNG")
        with patch.object(self.api, "check_is_dog_or_lesion", return_value=True), contextlib.redirect_stdout(io.StringIO()):
            response = self.client.post("/predict?model_type=efficientnet_b3&b3_tta=true",
                files={"image": ("asymmetric.png", content.getvalue(), "image/png")})
        values = self.assert_prediction(response)
        self.assertEqual({row["label"]: row["score"] for row in values}, expected)
        self.assertFalse(model.training)
        self.assertTrue(all(module.training is False for module in model.modules()))
        digest = hashlib.sha256((MODEL_DIR / "efficientnet_b3_model.pth").read_bytes()).hexdigest()
        self.assertEqual(digest, self.metadata["weights_sha256"])

    def test_six_views_match_b0_for_dark_bright_small_and_exif_images(self):
        for size, color in [((190, 110), (20, 35, 50)), ((110, 190), (235, 240, 245)),
                            ((48, 60), (80, 120, 160))]:
            image = Image.new("RGB", size, color)
            image.paste((100, 60, 30), (0, 0, size[0] // 3, size[1]))
            image.getexif()[274] = 6
            corrected = ImageOps.exif_transpose(image).convert("RGB")
            actual = build_b3_batch(image, self.api.b3_transforms, self.api.device, use_tta=True)
            with patch.object(self.api, "inference_transforms", self.api.b3_transforms):
                reference = self.api.build_tta_batch(corrected)
            torch.testing.assert_close(actual, reference, rtol=0, atol=0)
            baseline = build_b3_batch(image, self.api.b3_transforms, self.api.device, use_tta=False)
            torch.testing.assert_close(actual[:1], baseline, rtol=0, atol=0)

    def test_tta_default_requires_matching_validation_evidence(self):
        self.assertFalse(get_b3_tta_default(self.metadata))
        policy = {"tta_mode": "six_view_v1", "selection_dataset": "val",
            "weights_sha256": self.metadata["weights_sha256"],
            "split_sha256": self.metadata["dataset"]["split_sha256"], "images": 1930,
            "validation_comparison": {"none": {"macro_f1": 0.90}, "six_view_v1": {"macro_f1": 0.91}}}
        self.assertTrue(get_b3_tta_default({**self.metadata, "inference": policy}))
        with self.assertRaises(ValueError):
            get_b3_tta_default({**self.metadata, "inference": {**policy, "selection_dataset": "test"}})
        with self.assertRaises(ValueError):
            get_b3_tta_default({**self.metadata, "inference": {**policy, "weights_sha256": "0" * 64}})
        with self.assertRaises(ValueError):
            get_b3_tta_default({**self.metadata, "inference": {**policy, "tta_mode": "none"}})

    def test_tta_flag_overrides_default_and_compare_forwards_it(self):
        with patch.object(self.api, "b3_default_tta", True):
            automatic = self.assert_prediction(self.post("/predict?model_type=efficientnet_b3"))
            explicit = self.assert_prediction(self.post("/predict?model_type=efficientnet_b3&b3_tta=true"))
            self.assertEqual(automatic, explicit)
            with patch.object(self.api, "build_b3_batch", wraps=build_b3_batch) as build:
                self.assert_prediction(self.post("/predict?model_type=efficientnet_b3&b3_tta=false"))
                self.assertFalse(build.call_args.kwargs["use_tta"])
        with patch.object(self.api, "build_b3_batch", wraps=build_b3_batch) as build:
            response = self.post("/compare?b3_tta=true")
            self.assertEqual(response.status_code, 200)
            self.assertTrue(build.call_args.kwargs["use_tta"])

    def test_legacy_choices_still_return_prediction_arrays(self):
        for name in ["mobilenet", "efficientnet"]:
            self.assert_prediction(self.post(f"/predict?model_type={name}"))

    def test_compare_and_both_alias_include_three_separate_results(self):
        for route in ["/compare", "/predict?model_type=all", "/predict?model_type=both"]:
            response = self.post(route)
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(set(response.json()), {"mobilenet", "efficientnet", "efficientnet_b3"})
            for values in response.json().values():
                self.assertEqual(len(values), 6)

    def test_missing_b3_falls_back_in_auto_and_errors_when_requested(self):
        with patch.object(self.api, "model_efficientnet_b3", None):
            self.assert_prediction(self.post("/predict"))
            self.assertEqual(self.post("/predict?model_type=efficientnet_b3").status_code, 503)
            self.assertIsNone(self.post("/compare").json()["efficientnet_b3"])

    def test_invalid_image_model_and_rejected_guardrail(self):
        self.assertEqual(self.post("/predict?model_type=unknown").status_code, 422)
        invalid = self.client.post("/predict", files={"image": ("broken.png", b"not an image", "image/png")})
        self.assertEqual(invalid.status_code, 400)
        with patch.object(self.api, "check_is_dog_or_lesion", return_value=False):
            rejected = self.client.post("/predict", files={"image": ("fixture.png", self.image_bytes, "image/png")})
        self.assertEqual(rejected.status_code, 400)

    def test_learn_keeps_b3_out_of_the_legacy_training_loop(self):
        class TinyClassifier(torch.nn.Module):
            def __init__(self):
                super().__init__()
                self.features = torch.nn.Sequential(torch.nn.Linear(3, 3))
                self.classifier = torch.nn.Sequential(torch.nn.Linear(3, 6))

            def forward(self, images):
                return self.classifier(self.features(images.mean(dim=(2, 3))))

        before = self.api.model_efficientnet_b3.classifier[1].weight.detach().clone()
        with (patch.object(self.api, "model_mobilenet", TinyClassifier()),
              patch.object(self.api, "model_efficientnet", TinyClassifier()),
              patch.object(self.api, "MODEL_DIR", MODEL_DIR / "test_output_not_written"),
              patch.object(Path, "mkdir"), patch.object(Image.Image, "save"),
              patch.object(self.api.torch, "save") as save):
            response = self.client.post("/learn", data={"true_label": "healthy"},
                files={"image": ("fixture.png", self.image_bytes, "image/png")})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(set(response.json()["losses"]), {"mobilenet", "efficientnet"})
        self.assertEqual(response.json()["unchanged_models"], ["efficientnet_b3"])
        self.assertEqual(save.call_count, 2)
        self.assertTrue(all(call.args[1].name != "efficientnet_b3_model.pth" for call in save.call_args_list))
        torch.testing.assert_close(before, self.api.model_efficientnet_b3.classifier[1].weight, rtol=0, atol=0)

    def test_checkpoint_still_matches_evaluated_weights(self):
        digest = hashlib.sha256((MODEL_DIR / "efficientnet_b3_model.pth").read_bytes()).hexdigest()
        self.assertEqual(digest, self.metadata["weights_sha256"])


if __name__ == "__main__":
    unittest.main()
