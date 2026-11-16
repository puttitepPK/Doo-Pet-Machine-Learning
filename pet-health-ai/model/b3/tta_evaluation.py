"""Validation-only comparison of deterministic six-view TTA for B3.

The same functions are embedded in the Colab notebook so it does not need this repo.
"""

import copy

import numpy as np
import torch
from sklearn.metrics import accuracy_score, classification_report, f1_score
from tqdm.auto import tqdm


def collect_tta_pairs(model, loader, device, num_classes):
    """Compare baseline with six preprocessed PIL variants of each ordered image.

    Loaders return [B, 6, C, H, W], or [B, C, H, W] for baseline only.
    Forward one view at a time to avoid a 6x larger GPU batch.
    """
    model.eval()
    original_scores, tta_scores, labels = [], [], []
    with torch.inference_mode():
        for images, targets in tqdm(loader, desc="Single image vs six-view TTA"):
            if images.ndim == 4:
                images = images.unsqueeze(1)
            if images.ndim != 5 or images.shape[1] not in (1, 6):
                raise ValueError("Expected one or six preprocessed views per image")
            view_scores = []
            for view_index in range(images.shape[1]):
                scores = torch.softmax(model(images[:, view_index].to(device)).float(), dim=1)
                if scores.shape != (len(images), num_classes):
                    raise ValueError("Unexpected classifier output shape")
                if not torch.isfinite(scores).all():
                    raise ValueError("Non-finite classifier scores")
                view_scores.append(scores.cpu())
            original = view_scores[0]
            original_scores.append(original.cpu().numpy())
            tta_scores.append(torch.stack(view_scores).mean(dim=0).numpy())
            labels.extend(targets.tolist())
    if not labels:
        raise ValueError("Evaluation split is empty")
    return np.concatenate(original_scores), np.concatenate(tta_scores), np.asarray(labels, dtype=np.int64)


def summarize_tta_scores(labels, scores, class_names):
    labels, scores = np.asarray(labels), np.asarray(scores)
    if scores.shape != (len(labels), len(class_names)) or not len(labels):
        raise ValueError("Scores must have one row per image and one column per class")
    if (not np.isfinite(scores).all() or (scores < 0).any() or (scores > 1).any()
            or not np.allclose(scores.sum(axis=1), 1.0, atol=1e-5)
            or not np.isin(labels, np.arange(len(class_names))).all()):
        raise ValueError("Invalid probabilities or labels")
    predicted = scores.argmax(axis=1)
    correct = predicted == labels
    metrics = {
        "accuracy": float(accuracy_score(labels, predicted)),
        "macro_f1": float(f1_score(labels, predicted, labels=list(range(len(class_names))),
                                    average="macro", zero_division=0)),
        "weighted_f1": float(f1_score(labels, predicted, labels=list(range(len(class_names))),
                                       average="weighted", zero_division=0)),
        "images": len(labels), "errors": int((~correct).sum()),
        "errors_with_score_at_least_95pct": int(((~correct) & (scores.max(axis=1) >= 0.95)).sum()),
    }
    report = classification_report(labels, predicted, labels=list(range(len(class_names))),
                                     target_names=class_names, output_dict=True, zero_division=0)
    return metrics, {name: report[name] for name in class_names}


def select_tta_metadata(metadata, single_metrics, tta_metrics, weights_sha256, split_sha256):
    """Select using Validation Macro F1; ties retain the cheaper single-view path."""
    expected_images = metadata["dataset"]["split_counts"]["val"]
    if (single_metrics["images"] != expected_images or tta_metrics["images"] != expected_images
            or split_sha256 != metadata["dataset"]["split_sha256"]):
        raise ValueError("The comparison must use the saved Validation split")
    previous_hash = metadata.get("weights_sha256")
    if previous_hash is not None and previous_hash != weights_sha256:
        raise ValueError("The comparison refers to different weights")
    for value in [single_metrics["macro_f1"], tta_metrics["macro_f1"]]:
        if not np.isfinite(value) or not 0 <= value <= 1:
            raise ValueError("Invalid Validation Macro F1")
    use_tta = tta_metrics["macro_f1"] > single_metrics["macro_f1"] + 1e-6
    result = copy.deepcopy(metadata)
    result["weights_sha256"] = weights_sha256
    result["inference"] = {
        "tta_mode": "six_view_v1" if use_tta else "none", "selection_dataset": "val",
        "weights_sha256": weights_sha256, "split_sha256": split_sha256,
        "images": expected_images, "selection_metric": "macro_f1",
        "validation_comparison": {"none": single_metrics, "six_view_v1": tta_metrics},
    }
    return result
