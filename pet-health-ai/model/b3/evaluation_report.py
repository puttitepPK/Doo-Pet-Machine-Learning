"""Readable post-training reports; also embedded in the self-contained Colab notebook."""

from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.metrics import classification_report, confusion_matrix, ConfusionMatrixDisplay
from IPython.display import Markdown, display


def calculate_report_metrics(targets, probabilities, class_names, class_weights=None):
    """Compute comparable metrics and weighted NLL from saved probabilities, never train."""
    targets = np.asarray(targets)
    probabilities = np.asarray(probabilities, dtype=np.float64)
    count = len(class_names)
    if (targets.ndim != 1 or not len(targets) or probabilities.shape != (len(targets), count)
            or not np.isin(targets, np.arange(count)).all()
            or not np.isfinite(probabilities).all() or (probabilities < 0).any()
            or (probabilities > 1).any()
            or not np.allclose(probabilities.sum(axis=1), 1.0, atol=1e-5)):
        raise ValueError("Invalid labels or class probabilities for the report")
    targets = targets.astype(np.int64)
    predicted = probabilities.argmax(axis=1)
    true_scores = probabilities[np.arange(len(targets)), targets]
    nll = -np.log(np.clip(true_scores, np.finfo(np.float64).tiny, 1.0))
    weights = np.ones(count) if class_weights is None else np.asarray(class_weights, dtype=np.float64)
    if weights.shape != (count,) or not np.isfinite(weights).all() or (weights <= 0).any():
        raise ValueError("Invalid class weights for report loss")
    full_report = classification_report(targets, predicted, labels=list(range(count)),
                                        target_names=class_names, output_dict=True, zero_division=0)
    correct = predicted == targets
    metrics = {
        "loss": float(np.average(nll, weights=weights[targets])),
        "loss_definition": "class_weighted_nll" if class_weights is not None else "nll",
        "unweighted_nll": float(nll.mean()),
        "clipped_zero_true_scores": int((true_scores == 0).sum()),
        "accuracy": float(correct.mean()),
        "precision_macro": float(full_report["macro avg"]["precision"]),
        "recall_macro": float(full_report["macro avg"]["recall"]),
        "macro_f1": float(full_report["macro avg"]["f1-score"]),
        "weighted_f1": float(full_report["weighted avg"]["f1-score"]),
        "images": int(len(targets)), "correct": int(correct.sum()), "errors": int((~correct).sum()),
        "errors_with_score_at_least_95pct": int(((~correct) & (probabilities.max(axis=1) >= 0.95)).sum()),
    }
    return metrics, {name: full_report[name] for name in class_names}


def training_report_snapshot(history, metadata):
    required = {"global_epoch", "train_loss", "train_accuracy", "val_loss", "val_accuracy", "val_macro_f1"}
    if history.empty or not required.issubset(history.columns) or history["global_epoch"].duplicated().any():
        raise ValueError("Training history is empty, duplicated, or missing required columns")
    selected_epoch = metadata.get("best_validation", {}).get("global_epoch")
    if selected_epoch is None:
        raise ValueError("Metadata must identify the selected checkpoint epoch")
    selected = history.loc[history["global_epoch"].eq(selected_epoch)]
    if len(selected) != 1:
        raise ValueError("Selected checkpoint epoch is missing from training history")
    row = selected.iloc[0]
    return {"global_epoch": int(selected_epoch), "completed_epochs": int(len(history)),
            "last_epoch": int(history["global_epoch"].max()),
            "loss": float(row["train_loss"]), "accuracy": float(row["train_accuracy"]),
            "val_loss_during_training": float(row["val_loss"]),
            "val_accuracy_during_training": float(row["val_accuracy"]),
            "val_macro_f1_during_training": float(row["val_macro_f1"])}


def report_overall_table(named_metrics):
    rows = []
    for label, metrics in named_metrics.items():
        rows.append({"ชุดข้อมูล / วิธี": label, "Loss ↓": f"{metrics['loss']:.4f}",
                     "Accuracy ↑": f"{metrics['accuracy']:.2%}",
                     "Precision (Macro) ↑": f"{metrics['precision_macro']:.2%}" if "precision_macro" in metrics else "—",
                     "Recall (Macro) ↑": f"{metrics['recall_macro']:.2%}" if "recall_macro" in metrics else "—",
                     "Macro F1 ↑": f"{metrics['macro_f1']:.2%}" if "macro_f1" in metrics else "—",
                     "ภาพ": metrics.get("images", "—")})
    return pd.DataFrame(rows)


def render_classification_report(report, class_names, thai_names, title, output_prefix):
    frame = pd.DataFrame(report).T.loc[class_names, ["precision", "recall", "f1-score", "support"]].copy()
    frame["support"] = frame["support"].astype(int)
    frame.to_csv(str(output_prefix) + "_classification_report.csv")
    shown = pd.DataFrame({"กลุ่ม": [thai_names.get(name, name) for name in class_names],
                          "Precision ↑": frame["precision"].map(lambda value: f"{value:.2%}").to_numpy(),
                          "Recall ↑": frame["recall"].map(lambda value: f"{value:.2%}").to_numpy(),
                          "F1-score ↑": frame["f1-score"].map(lambda value: f"{value:.2%}").to_numpy(),
                          "จำนวนภาพจริง (Support)": frame["support"].to_numpy()})
    display(Markdown(f"**{title}: ผลแยกตาม 6 กลุ่ม**"))
    display(shown)
    x = np.arange(len(class_names))
    fig, axis = plt.subplots(figsize=(12, 4.5))
    for offset, field, label, color in [(-0.25, "precision", "Precision", "#2878b5"),
                                       (0, "recall", "Recall", "#e78a32"),
                                       (0.25, "f1-score", "F1", "#479b72")]:
        axis.bar(x + offset, frame[field] * 100, width=0.25, label=label, color=color)
    axis.set(xticks=x, xticklabels=class_names, ylim=(0, 105), ylabel="Score (%)", title=title)
    axis.tick_params(axis="x", rotation=25)
    axis.grid(axis="y", alpha=0.2)
    axis.legend()
    fig.tight_layout()
    fig.savefig(str(output_prefix) + "_class_scores.png", dpi=150)
    plt.show()
    plt.close(fig)
    worst = frame["recall"].idxmin()
    display(Markdown(f"อ่านกราฟ: แท่งสูงยิ่งดี; **Recall ต่ำสุดคือ {thai_names.get(worst, worst)} "
                     f"({frame.loc[worst, 'recall']:.2%})** เป็นกลุ่มที่ควรตรวจภาพพลาดเพิ่มเติม"))


def render_confusion_report(targets, predicted, class_names, title, output_prefix):
    matrix = confusion_matrix(targets, predicted, labels=list(range(len(class_names))))
    pd.DataFrame(matrix, index=class_names, columns=class_names).to_csv(str(output_prefix) + "_confusion_matrix.csv")
    row_totals = matrix.sum(axis=1, keepdims=True)
    normalized = np.divide(matrix, row_totals, out=np.zeros_like(matrix, dtype=float), where=row_totals != 0)
    fig, axes = plt.subplots(1, 2, figsize=(16, 6))
    for axis, values, label, fmt in [(axes[0], matrix, "Counts", "d"),
                                     (axes[1], normalized * 100, "Percent of true class", ".1f")]:
        ConfusionMatrixDisplay(values, display_labels=class_names).plot(
            ax=axis, cmap="Blues", colorbar=False, xticks_rotation=45, values_format=fmt)
        axis.set_title(label)
    fig.suptitle(title)
    fig.tight_layout()
    fig.savefig(str(output_prefix) + "_confusion_matrix.png", dpi=150)
    plt.show()
    plt.close(fig)
    display(Markdown("อ่าน Confusion Matrix: **แถว = กลุ่มจริง, คอลัมน์ = กลุ่มที่ทำนาย** "
                     "แนวทแยงคือทายถูก ช่องอื่นคือทายผิด ด้านซ้ายเป็นจำนวนภาพ ด้านขวาเป็นเปอร์เซ็นต์ภายในแถว "
                     "ผลรวมแต่ละแถวตรงกับ Support ในตารางด้านบน"))


def render_learning_report(history, snapshot, output_path):
    fig, axes = plt.subplots(1, 3, figsize=(15, 4))
    for axis, metric, title in zip(axes, ["loss", "accuracy", "macro_f1"],
                                   ["Loss (lower is better)", "Accuracy (%)", "Macro F1 (%)"]):
        scale = 1 if metric == "loss" else 100
        axis.plot(history["global_epoch"], history[f"train_{metric}"] * scale, label="Train")
        axis.plot(history["global_epoch"], history[f"val_{metric}"] * scale, label="Validation")
        axis.axvline(snapshot["global_epoch"], color="#555", linestyle="--", label="Selected checkpoint")
        axis.set(title=title, xlabel="Global epoch")
        axis.grid(alpha=0.2)
        axis.legend()
    fig.tight_layout()
    fig.savefig(output_path, dpi=150)
    plt.show()
    plt.close(fig)
    display(Markdown("อ่านกราฟจากซ้ายไปขวา: **Loss ยิ่งต่ำยิ่งดี ส่วน Accuracy และ Macro F1 ยิ่งสูงยิ่งดี** "
                     "เส้นประคือรอบของน้ำหนักที่เลือกใช้ หาก Train ดีขึ้นต่อแต่ Validation แย่ลงต่อเนื่อง "
                     "อาจเป็นสัญญาณ Overfitting ไม่ควรตัดสินจาก Train เพียงเส้นเดียว"))
