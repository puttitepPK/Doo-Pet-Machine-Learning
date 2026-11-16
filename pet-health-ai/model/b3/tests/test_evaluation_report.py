"""Verify report mathematics and exportable plots independently of the real dataset."""

import contextlib
import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import classification_report

from model.b3.evaluation_report import (
    calculate_report_metrics, render_classification_report, render_confusion_report,
    report_overall_table, training_report_snapshot,
)


class EvaluationReportTests(unittest.TestCase):
    def test_macro_metrics_and_weighted_loss_match_independent_definitions(self):
        names = ["a", "b", "c"]
        labels = np.array([0, 0, 1, 2])
        scores = np.array([[0.8, 0.1, 0.1], [0.3, 0.6, 0.1], [0.1, 0.7, 0.2], [0.1, 0.2, 0.7]])
        metrics, report = calculate_report_metrics(labels, scores, names, [1, 2, 4])
        expected_loss = (-np.log(0.8) - np.log(0.3) - 2 * np.log(0.7) - 4 * np.log(0.7)) / 8
        self.assertAlmostEqual(metrics["loss"], expected_loss)
        reference = classification_report(labels, scores.argmax(1), target_names=names,
                                          output_dict=True, zero_division=0)
        self.assertAlmostEqual(metrics["precision_macro"], reference["macro avg"]["precision"])
        self.assertAlmostEqual(metrics["recall_macro"], reference["macro avg"]["recall"])
        self.assertAlmostEqual(metrics["macro_f1"], reference["macro avg"]["f1-score"])
        self.assertEqual((metrics["correct"], metrics["errors"], metrics["images"]), (3, 1, 4))
        self.assertEqual(set(report), set(names))
        self.assertEqual(metrics["loss_definition"], "class_weighted_nll")

    def test_selected_epoch_is_distinct_from_last_and_train_summary_uses_dashes(self):
        history = pd.DataFrame({"global_epoch": [1, 2], "train_loss": [0.4, 0.2],
                                "train_accuracy": [0.8, 0.9], "val_loss": [0.5, 0.6],
                                "val_accuracy": [0.8, 0.7], "val_macro_f1": [0.8, 0.7]})
        snapshot = training_report_snapshot(history, {"best_validation": {"global_epoch": 1}})
        self.assertEqual((snapshot["global_epoch"], snapshot["last_epoch"], snapshot["completed_epochs"]), (1, 2, 2))
        self.assertAlmostEqual(snapshot["loss"], 0.4)
        summary = report_overall_table({"Train": snapshot})
        self.assertEqual(summary.iloc[0]["Macro F1 ↑"], "—")
        self.assertEqual(summary.iloc[0]["Accuracy ↑"], "80.00%")

    def test_zero_probability_is_reported_and_invalid_scores_are_rejected(self):
        metrics, _ = calculate_report_metrics([0], [[0, 1]], ["a", "b"])
        self.assertTrue(np.isfinite(metrics["loss"]))
        self.assertEqual(metrics["clipped_zero_true_scores"], 1)
        with self.assertRaises(ValueError):
            calculate_report_metrics([0], [[0.1, 0.1]], ["a", "b"])

    def test_plots_and_six_class_csv_are_exported_with_matching_support(self):
        names = ["bacterial_dermatosis", "demodicosis", "dermatitis", "fungal_infection", "healthy", "hypersensitivity"]
        labels = np.arange(6)
        scores = np.eye(6) * 0.8 + 0.2 / 6
        _, report = calculate_report_metrics(labels, scores, names)
        with tempfile.TemporaryDirectory() as directory:
            prefix = Path(directory) / "test"
            with contextlib.redirect_stdout(io.StringIO()), patch("matplotlib.pyplot.show"):
                render_classification_report(report, names, {}, "Synthetic Test", prefix)
                render_confusion_report(labels, scores.argmax(1), names, "Synthetic Test", prefix)
            frame = pd.read_csv(str(prefix) + "_classification_report.csv", index_col=0)
            self.assertEqual(frame["support"].tolist(), [1] * 6)
            self.assertEqual(frame.index.tolist(), names)
            matrix = pd.read_csv(str(prefix) + "_confusion_matrix.csv", index_col=0)
            np.testing.assert_array_equal(matrix.to_numpy().sum(axis=1), frame["support"].to_numpy())
            for suffix in ["_class_scores.png", "_confusion_matrix.png"]:
                self.assertGreater(Path(str(prefix) + suffix).stat().st_size, 1000)
        plt.close("all")


if __name__ == "__main__":
    unittest.main()
