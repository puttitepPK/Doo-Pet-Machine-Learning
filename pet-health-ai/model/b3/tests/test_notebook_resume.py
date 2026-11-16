"""Exercise the actual notebook cells in a fresh namespace with saved Run artifacts."""

import contextlib
import hashlib
import io
import json
from pathlib import Path
import tempfile
import zipfile
import unittest
from unittest.mock import patch

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd
from sklearn.metrics import accuracy_score, classification_report, f1_score


NAMES = ["bacterial_dermatosis", "demodicosis", "dermatitis",
         "fungal_infection", "healthy", "hypersensitivity"]


class NotebookResumeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.project = Path(self.temp.name)
        self.run = self.project / "experiments/efficientnet_b3/20261107T213510Z_a93190"
        self.run.mkdir(parents=True)
        notebook = json.loads((Path(__file__).resolve().parents[1] /
                               "DL_EfficientNet_B3_Model.ipynb").read_text(encoding="utf-8"))
        self.cell14 = next("".join(cell["source"]) for cell in notebook["cells"]
                           if cell["cell_type"] == "code" and "history_frame = pd.read_csv" in "".join(cell["source"]))
        self.cell15 = next("".join(cell["source"]) for cell in notebook["cells"]
                           if cell["cell_type"] == "code" and "def collect_predictions(" in "".join(cell["source"]))
        history = {"global_epoch": [1, 2, 3]}
        for metric in ["loss", "accuracy", "macro_f1"]:
            history[f"train_{metric}"] = [0.5, 0.6, 0.7]
            history[f"val_{metric}"] = [0.4, 0.5, 0.6]
        pd.DataFrame(history).to_csv(self.run / "history.csv", index=False)
        self.weights = self.run / "efficientnet_b3_model.pth"
        self.weights.write_bytes(b"saved checkpoint; must not be loaded to review existing results")
        rows = [{"zip_path": f"dog_skin_dataset/{name}/{index}.jpg", "class": name,
                 "group6": f"case{index}", "md5": str(index), "split": "test"}
                for index, name in enumerate(NAMES)]
        pd.DataFrame(rows).to_csv(self.run / "manifest_split.csv", index=False)
        weights_hash = hashlib.sha256(self.weights.read_bytes()).hexdigest()
        split_hash = hashlib.sha256((self.run / "manifest_split.csv").read_bytes()).hexdigest()
        metadata = {"architecture": "efficientnet_b3", "class_names": NAMES,
                    "class_to_idx": {name: i for i, name in enumerate(NAMES)}, "num_classes": 6,
                    "weights_sha256": weights_hash,
                    "best_validation": {"global_epoch": 3},
                    "training": {"warmup_epochs": 1, "finetune_epochs": 2, "class_weights": False},
                    "dataset": {"split_sha256": split_hash, "split_counts": {"train": 10, "val": 6, "test": 6}}}
        (self.run / "model_metadata.json").write_text(json.dumps(metadata), encoding="utf-8")
        targets, predictions = list(range(6)), [0, 1, 2, 3, 4, 0]
        metrics = {"accuracy": accuracy_score(targets, predictions),
                   "macro_f1": f1_score(targets, predictions, average="macro"),
                   "weighted_f1": f1_score(targets, predictions, average="weighted"),
                   "images": 6, "weights_sha256": weights_hash, "split_sha256": split_hash, "tta": False}
        (self.run / "test_metrics.json").write_text(json.dumps(metrics), encoding="utf-8")
        saved = pd.DataFrame(rows)
        saved["true_index"], saved["pred_index"] = targets, predictions
        for index, name in enumerate(NAMES):
            saved[f"score_{name}"] = [0.8 + 0.2 / 6 if prediction == index else 0.2 / 6 for prediction in predictions]
        saved.to_csv(self.run / "test_predictions.csv", index=False)
        report = classification_report(targets, predictions, target_names=NAMES,
                                       output_dict=True, zero_division=0)
        pd.DataFrame(report).T.to_csv(self.run / "classification_report.csv")

    def tearDown(self):
        plt.close("all")
        self.temp.cleanup()

    def execute(self, cell):
        fresh = {"PROJECT_DIR": self.project}
        with contextlib.redirect_stdout(io.StringIO()), patch("matplotlib.pyplot.show"), patch(
                "torch.load", side_effect=AssertionError("Saved-result review must not load or train a model")):
            exec(compile(cell, "notebook_resume", "exec"), fresh)
        return fresh

    def test_history_runs_without_run_dir_or_training_globals(self):
        result = self.execute(self.cell14)
        self.assertEqual(result["RUN_DIR"], self.run)
        self.assertEqual(result["history_frame"]["global_epoch"].tolist(), [1, 2, 3])
        self.assertTrue((result["report_dir"] / "learning_curves.png").is_file())

    def test_saved_test_runs_without_completed_phases_model_or_loader(self):
        result = self.execute(self.cell15)
        self.assertEqual(result["test_metrics"]["images"], 6)
        self.assertEqual(result["all_predictions"].tolist(), [0, 1, 2, 3, 4, 0])
        self.assertEqual(result["class_report"]["support"].tolist(), [1] * 6)
        self.assertNotIn("completed_phases", result)
        self.assertNotIn("model", result)

    def test_changed_checkpoint_cannot_reuse_saved_test_metrics(self):
        self.weights.write_bytes(b"different checkpoint")
        with self.assertRaisesRegex(ValueError, "น้ำหนัก"):
            self.execute(self.cell15)

    def test_missing_saved_test_explains_reload_instead_of_requiring_training(self):
        (self.run / "test_metrics.json").unlink()
        with self.assertRaisesRegex(RuntimeError, "14.2"):
            self.execute(self.cell15)

    def test_complete_report_and_export_run_in_order_without_training(self):
        import torch
        from torch import nn
        from PIL import Image
        from torchvision import models
        from model.b3.evaluation_report import calculate_report_metrics

        seen_batches = []

        class TinyClassifier(nn.Module):
            def __init__(self):
                super().__init__()
                self.classifier = nn.Sequential(nn.Dropout(0.2), nn.Linear(3, 6))

            def forward(self, images):
                seen_batches.append(len(images))
                return self.classifier(images.mean(dim=(-1, -2)))

        torch.manual_seed(12)
        torch.set_num_threads(2)
        reference_model = TinyClassifier().eval()
        torch.save(reference_model.state_dict(), self.weights)
        rows, images = [], {}
        with zipfile.ZipFile(self.project / "dog_skin_dataset.zip", "w") as archive:
            for split_index, split in enumerate(["train", "val", "test"]):
                for class_index, name in enumerate(NAMES):
                    member = f"dog_skin_dataset/{name}/{split}.png"
                    image = Image.new("RGB", (80, 90),
                                      (20 + class_index * 20, 40 + split_index * 40, 70 + class_index * 10))
                    image.paste((210, 30 + class_index, 60 + split_index), (0, 0, 20, 90))
                    content = io.BytesIO()
                    image.save(content, format="PNG")
                    raw = content.getvalue()
                    archive.writestr(member, raw)
                    images[member] = image
                    rows.append({"zip_path": member, "class": name, "md5": hashlib.md5(raw).hexdigest(),
                                 "group6": f"{split}_{class_index}", "split": split})
            manifest = pd.DataFrame(rows)
            archive.writestr("dog_skin_dataset/manifest.csv", manifest.drop(columns=["split"]).to_csv(index=False))
        manifest.to_csv(self.run / "manifest_split.csv", index=False)
        self.project.joinpath("manifest_split.csv").write_bytes(self.run.joinpath("manifest_split.csv").read_bytes())
        metadata = json.loads(self.run.joinpath("model_metadata.json").read_text(encoding="utf-8"))
        metadata["weights_sha256"] = hashlib.sha256(self.weights.read_bytes()).hexdigest()
        metadata["dataset"] = {"zip_md5": hashlib.md5(self.project.joinpath("dog_skin_dataset.zip").read_bytes()).hexdigest(),
                               "split_sha256": hashlib.sha256(self.run.joinpath("manifest_split.csv").read_bytes()).hexdigest(),
                               "images": 18, "split_counts": {"train": 6, "val": 6, "test": 6}}
        metadata["preprocessing"] = {"center_crop": 300, "resize_shorter_side": 320, "tta": False}
        metadata["training"].update(class_weights=True, class_weight_values=[1, 2, 1, 2, 1, 2])
        self.run.joinpath("model_metadata.json").write_text(json.dumps(metadata), encoding="utf-8")
        test_frame = manifest[manifest["split"].eq("test")].reset_index(drop=True)
        transform = models.EfficientNet_B3_Weights.DEFAULT.transforms()
        with torch.inference_mode():
            scores = torch.softmax(reference_model(torch.stack([transform(images[path]) for path in test_frame["zip_path"]])), dim=1).numpy()
        targets = test_frame["class"].map({name: i for i, name in enumerate(NAMES)}).to_numpy()
        baseline, report = calculate_report_metrics(targets, scores, NAMES)
        baseline.update(weights_sha256=metadata["weights_sha256"], split_sha256=metadata["dataset"]["split_sha256"], tta=False)
        self.run.joinpath("test_metrics.json").write_text(json.dumps(baseline), encoding="utf-8")
        predictions = test_frame.copy()
        predictions["true_index"], predictions["pred_index"] = targets, scores.argmax(axis=1)
        for index, name in enumerate(NAMES):
            predictions[f"score_{name}"] = scores[:, index]
        predictions.to_csv(self.run / "test_predictions.csv", index=False)
        pd.DataFrame(report).T.to_csv(self.run / "classification_report.csv")
        pd.DataFrame().to_csv(self.run / "confusion_matrix.csv")
        for name in ["learning_curves.png", "confusion_matrix.png"]:
            Image.new("RGB", (20, 20)).save(self.run / name)
        notebook = json.loads((Path(__file__).resolve().parents[1] /
                               "DL_EfficientNet_B3_Model.ipynb").read_text(encoding="utf-8"))
        report_cells = ["".join(cell["source"]) for cell in notebook["cells"] if cell["cell_type"] == "code" and
                        any(marker in "".join(cell["source"]) for marker in
                            ["history_frame = pd.read_csv", "def collect_tta_pairs(", "validation_tta_loader = DataLoader", "def collect_predictions(", "tta_test_expected_labels ="])]
        export_cell = next("".join(cell["source"]) for cell in notebook["cells"] if cell["cell_type"] == "code" and "export_run_dir =" in "".join(cell["source"]))
        self.assertEqual(len(report_cells), 5)
        fresh = {"PROJECT_DIR": self.project}
        original_exists = Path.exists

        def mounted_drive(path):
            if str(path).replace("\\", "/") == "/content/drive/MyDrive":
                return True
            return original_exists(path)

        with (contextlib.redirect_stdout(io.StringIO()), patch("matplotlib.pyplot.show"),
              patch.object(Path, "exists", mounted_drive),
              patch.object(models, "efficientnet_b3", side_effect=lambda **kwargs: TinyClassifier()),
              patch.object(torch.optim.AdamW, "step", side_effect=AssertionError("Reports must not train"))):
            for source in report_cells + [export_cell]:
                source = source.replace('Path("/content/pet_health_b3")', f"Path({str(self.project / 'work')!r})")
                if "validation_single_loader = DataLoader" in source:
                    fresh["tta_pair_metrics"] = {"stale_from_previous_run": True}
                    fresh["tta_selected_metadata"] = {"stale_from_previous_run": True}
                before_views = sum(seen_batches)
                exec(compile(source, "full_notebook_report", "exec"), fresh)
                if "validation_single_loader = DataLoader" in source:
                    self.assertEqual(sum(seen_batches) - before_views, 6)
                    self.assertNotIn("tta_pair_metrics", fresh)
                    self.assertNotIn("tta_selected_metadata", fresh)
                    self.assertTrue((fresh["report_dir"] / "validation_none_class_scores.png").is_file())
                if "validation_tta_loader = DataLoader" in source:
                    self.assertEqual(sum(seen_batches) - before_views, 6 * 6)
                    self.assertTrue((fresh["report_dir"] / "validation_six_view_v1_class_scores.png").is_file())
        summary = fresh["report_summary"]
        self.assertEqual(len(summary), 3)
        self.assertTrue(fresh["REPORT_USE_TTA"])
        self.assertEqual(fresh["tta_test_metrics"]["images"], 6)
        self.assertEqual(fresh["tta_test_metrics"]["loss_definition"], "class_weighted_nll")
        self.assertTrue(all(parameter.grad is None for parameter in fresh["tta_eval_model"].parameters()))
        self.assertEqual(hashlib.sha256(self.weights.read_bytes()).hexdigest(), metadata["weights_sha256"])
        self.assertGreaterEqual(len(list(fresh["report_dir"].glob("*.png"))), 7)
        with zipfile.ZipFile(fresh["bundle_path"]) as exported:
            self.assertIn("reports/summary_six_view_v1.csv", exported.namelist())


if __name__ == "__main__":
    unittest.main()
