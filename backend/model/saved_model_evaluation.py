"""Independent evaluation contexts for saved MobileNetV3-Small and EfficientNet-B0.

The same helpers are embedded in Colab; no training or checkpoint writes occur here.
"""

import hashlib
import json
import shutil
import zipfile
from pathlib import Path, PurePosixPath

import numpy as np
import pandas as pd
import PIL
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
import matplotlib.pyplot as plt
import torch
from torch import nn
from torch.utils.data import Dataset, DataLoader
import torchvision
from torchvision import models, transforms
from tqdm.auto import tqdm
from IPython.display import Markdown, display

from .b3.evaluation_report import (
    calculate_report_metrics, report_overall_table, render_classification_report,
    render_confusion_report,
)


LEGACY_CLASS_NAMES = ["bacterial_dermatosis", "demodicosis", "dermatitis",
                      "fungal_infection", "healthy", "hypersensitivity"]
LEGACY_THAI_NAMES = {"bacterial_dermatosis": "โรคผิวหนังจากแบคทีเรีย", "demodicosis": "โรคขี้เรื้อนเปียก (ไรขุมขน)",
                     "dermatitis": "ผิวหนังอักเสบ", "fungal_infection": "โรคผิวหนังจากเชื้อรา",
                     "healthy": "ผิวหนังปกติ", "hypersensitivity": "ภาวะภูมิไวเกิน (อาการแพ้)"}


def legacy_file_hash(path, algorithm="sha256"):
    digest = hashlib.new(algorithm)
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def legacy_make_views(image, use_tta=False):
    """Exactly the six PIL variants used by the existing B0 API, before resize."""
    image = ImageOps.exif_transpose(image).convert("RGB")
    if not use_tta:
        return [image]
    pixels = list(image.convert("L").getdata())
    brightness = sum(pixels) / max(len(pixels), 1)
    enhanced = ImageOps.autocontrast(image, cutoff=1)
    if brightness < 90:
        factor = min(1.6, max(1.15, 115.0 / max(brightness, 1.0)))
        enhanced = ImageEnhance.Brightness(enhanced).enhance(factor)
        enhanced = ImageEnhance.Contrast(enhanced).enhance(1.25)
    elif brightness > 200:
        enhanced = ImageEnhance.Brightness(enhanced).enhance(0.82)
        enhanced = ImageEnhance.Contrast(enhanced).enhance(1.2)
    enhanced = ImageEnhance.Sharpness(enhanced).enhance(1.5)
    width, height = image.size
    box = (int(width * 0.12), int(height * 0.12), int(width * 0.88), int(height * 0.88))
    cropped = enhanced.crop(box) if width > 64 and height > 64 else enhanced
    sharpened = enhanced.filter(ImageFilter.SHARPEN)
    brighter = ImageEnhance.Contrast(ImageEnhance.Brightness(enhanced).enhance(1.2)).enhance(1.2)
    return [image, enhanced, cropped, sharpened, brighter, ImageOps.mirror(enhanced)]


def legacy_prepare_dataset(project_dir, split_path, work_root):
    """Validate the saved split and archive; reuse content-addressed Colab image files."""
    project_dir, split_path, work_root = Path(project_dir), Path(split_path), Path(work_root)
    archive_path = project_dir / "dog_skin_dataset.zip"
    if not archive_path.is_file() or not split_path.is_file():
        raise FileNotFoundError("ต้องมี dog_skin_dataset.zip และ manifest_split.csv รันขั้น 2 และตรวจพาธก่อน")
    frame = pd.read_csv(split_path, dtype={"md5": str, "zip_path": str, "group6": str})
    columns = ["zip_path", "class", "md5", "group6", "split"]
    if not set(columns).issubset(frame.columns) or frame[columns].isna().any().any():
        raise ValueError("Split มีข้อมูลไม่ครบ")
    if (frame["zip_path"].duplicated().any() or frame["md5"].duplicated().any()
            or (frame.groupby("group6")["split"].nunique() > 1).any()):
        raise ValueError("พบรูปซ้ำหรือกลุ่มภาพคล้ายข้าม split")
    if set(frame["split"]) != {"train", "val", "test"} or set(frame["class"]) != set(LEGACY_CLASS_NAMES):
        raise ValueError("ต้องมี Train/Val/Test และชื่อกลุ่มทั้ง 6 ตามระบบเดิม")
    archive_md5 = legacy_file_hash(archive_path, "md5")
    split_hash = legacy_file_hash(split_path)
    work_root.mkdir(parents=True, exist_ok=True)
    local_zip = work_root / f"dataset_{archive_md5}.zip"
    if not local_zip.is_file() or legacy_file_hash(local_zip, "md5") != archive_md5:
        shutil.copy2(archive_path, local_zip)
    if legacy_file_hash(local_zip, "md5") != archive_md5:
        raise IOError("คัดลอก ZIP ไม่สมบูรณ์")
    data_root = work_root / f"extracted_{archive_md5}"
    data_root.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(local_zip) as archive:
        for entry in archive.infolist():
            member = PurePosixPath(entry.filename)
            if (member.is_absolute() or ".." in member.parts or "\\" in entry.filename or ":" in entry.filename
                    or (entry.external_attr >> 16) & 0o170000 == 0o120000):
                raise ValueError("พบพาธ ZIP ไม่ปลอดภัย")
        marker = data_root / ".extracted_ok"
        if not marker.exists() or marker.read_text(encoding="utf-8") != archive_md5:
            if archive.testzip() is not None:
                raise ValueError("ZIP เสีย")
            archive.extractall(data_root)
            marker.write_text(archive_md5, encoding="utf-8")
    original = pd.read_csv(data_root / "dog_skin_dataset/manifest.csv", dtype={"md5": str, "zip_path": str, "group6": str})
    if original["zip_path"].duplicated().any() or set(original["zip_path"]) != set(frame["zip_path"]):
        raise ValueError("รายการภาพใน ZIP ไม่ตรงกับ split")
    original = original.set_index("zip_path")
    saved = frame.set_index("zip_path")
    for column in ["class", "md5", "group6"]:
        if not original.loc[saved.index, column].astype(str).equals(saved[column].astype(str)):
            raise ValueError(f"ข้อมูล {column} ใน ZIP กับ split ไม่ตรงกัน")
    return {"frame": frame, "data_root": data_root, "zip_md5": archive_md5,
            "split_sha256": split_hash, "split_path": split_path}


class LegacyCheckpointDataset(Dataset):
    def __init__(self, frame, data_root, transform, class_names, use_tta=False):
        self.frame = frame.reset_index(drop=True)
        self.data_root, self.transform = Path(data_root), transform
        self.mapping = {name: index for index, name in enumerate(class_names)}
        self.use_tta = use_tta

    def __len__(self):
        return len(self.frame)

    def __getitem__(self, index):
        row = self.frame.iloc[index]
        member = PurePosixPath(row["zip_path"])
        if (member.is_absolute() or ".." in member.parts or "\\" in row["zip_path"]
                or ":" in row["zip_path"] or not member.parts or member.parts[0] != "dog_skin_dataset"):
            raise ValueError("พาธภาพไม่ถูกต้อง")
        path = self.data_root.joinpath(*member.parts).resolve()
        if not path.is_relative_to(self.data_root.resolve()) or legacy_file_hash(path, "md5") != row["md5"]:
            raise ValueError(f"ไฟล์ภาพไม่ตรงกับ manifest: {row['zip_path']}")
        with Image.open(path) as image:
            views = legacy_make_views(image, self.use_tta)
            batch = torch.stack([self.transform(view) for view in views])
        return batch, self.mapping[row["class"]]


def legacy_render_overall(metrics, title, prefix):
    fig, axes = plt.subplots(1, 2, figsize=(11, 3.5))
    axes[0].bar(["Loss"], [metrics["loss"]], color="#a8774d")
    axes[0].text(0, metrics["loss"], f"{metrics['loss']:.4f}", ha="center", va="bottom")
    axes[0].set(title="Evaluation loss (lower is better)", ylabel="NLL")
    keys = ["accuracy", "precision_macro", "recall_macro", "macro_f1"]
    values = [metrics[key] * 100 for key in keys]
    bars = axes[1].bar(["Accuracy", "Macro P", "Macro R", "Macro F1"], values,
                       color=["#2878b5", "#e78a32", "#479b72", "#9163b6"])
    axes[1].bar_label(bars, labels=[f"{value:.2f}%" for value in values], padding=3, fontsize=9)
    axes[1].set(ylim=(0, 110), ylabel="Score (%)", title="Checkpoint evaluation")
    fig.suptitle(title)
    fig.tight_layout()
    fig.savefig(str(prefix) + "_overall.png", dpi=150)
    plt.show()
    plt.close(fig)


class SavedModelEvaluation:
    """One checkpoint owns its own data, results, caches, and output folder."""
    def __init__(self, architecture, weights_path, project_dir, *, split_path=None, work_root=None,
                 metadata_path=None, history_path=None, batch_size=8, device=None):
        if architecture not in ("mobilenet_v3_small", "efficientnet_b0"):
            raise ValueError("รองรับเฉพาะ MobileNetV3-Small และ EfficientNet-B0")
        self.architecture = architecture
        self.weights_path, self.project_dir = Path(weights_path), Path(project_dir)
        self.name = "MobileNetV3-Small" if architecture == "mobilenet_v3_small" else "EfficientNet-B0"
        if not self.weights_path.is_file():
            raise FileNotFoundError(f"ยังไม่พบ {self.weights_path} ให้อัปโหลด .pth หรือแก้พาธในขั้นตั้งค่าโมเดลนี้")
        self.weights_hash = legacy_file_hash(self.weights_path)
        self.class_names = list(LEGACY_CLASS_NAMES)
        self.metadata = json.loads(Path(metadata_path).read_text(encoding="utf-8")) if metadata_path and Path(metadata_path).is_file() else {}
        if self.metadata.get("architecture", architecture) != architecture:
            raise ValueError("Metadata ระบุสถาปัตยกรรมคนละโมเดล")
        if self.metadata.get("weights_sha256", self.weights_hash) != self.weights_hash:
            raise ValueError("Metadata เป็นของน้ำหนักคนละไฟล์")
        if self.metadata.get("class_names", self.class_names) != self.class_names:
            raise ValueError("ลำดับชื่อกลุ่มไม่ตรงกับระบบเดิม")
        if self.metadata.get("class_to_idx", {n: i for i,n in enumerate(self.class_names)}) != {n: i for i,n in enumerate(self.class_names)}:
            raise ValueError("class_to_idx ไม่ตรงกับระบบเดิม")
        state = torch.load(self.weights_path, map_location="cpu", weights_only=True)
        if isinstance(state, dict) and isinstance(state.get("state_dict"), dict):
            state = state["state_dict"]
        elif isinstance(state, dict) and isinstance(state.get("model_state_dict"), dict):
            state = state["model_state_dict"]
        key = "classifier.3.weight" if architecture == "mobilenet_v3_small" else "classifier.1.weight"
        if not isinstance(state, dict) or key not in state or state[key].shape[0] != 6:
            raise ValueError("ไฟล์ต้องเป็นโมเดลสถาปัตยกรรมนี้ที่ฝึกหัว 6 กลุ่มแล้ว ไม่สร้างหัวสุ่มแทน")
        if architecture == "mobilenet_v3_small":
            self.model = models.mobilenet_v3_small(weights=None)
            self.model.classifier[3] = nn.Linear(self.model.classifier[3].in_features, 6)
        else:
            self.model = models.efficientnet_b0(weights=None)
            self.model.classifier[1] = nn.Linear(self.model.classifier[1].in_features, 6)
        self.model.load_state_dict(state, strict=True)
        self.device = torch.device(device or ("cuda" if torch.cuda.is_available() else "cpu"))
        self.model = self.model.to(self.device).eval().requires_grad_(False)
        self.batch_size = batch_size
        self.transform = transforms.Compose([transforms.Resize((224, 224)), transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])])
        self.data = legacy_prepare_dataset(self.project_dir, split_path or self.project_dir / "manifest_split.csv",
                                           work_root or Path("/content/pet_health_b3"))
        self.holdout_verified = (self.metadata.get("weights_sha256") == self.weights_hash and
            self.metadata.get("dataset", {}).get("split_sha256") == self.data["split_sha256"])
        self.class_weights = self.metadata.get("training", {}).get("class_weight_values") if self.metadata.get("training", {}).get("class_weights", False) else None
        self.output_dir = self.project_dir / "evaluations" / architecture / (self.weights_hash[:12] + "_" + self.data["split_sha256"][:12])
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.results = {}
        self.history_path = history_path
        self.identity = {"architecture": architecture, "weights_sha256": self.weights_hash,
            "split_sha256": self.data["split_sha256"], "zip_md5": self.data["zip_md5"],
            "class_names": self.class_names, "preprocessing": "resize224_imagenet_v1",
            "torch": str(torch.__version__), "torchvision": str(torchvision.__version__),
            "pillow": str(PIL.__version__), "schema": 1}
        (self.output_dir / "evaluation_metadata.json").write_text(json.dumps(
            {**self.identity, "holdout_verified": self.holdout_verified, "weights_source": str(self.weights_path),
             "split_source": str(self.data["split_path"]), "loss_definition": "class_weighted_nll" if self.class_weights is not None else "nll"},
            ensure_ascii=False, indent=2), encoding="utf-8")

    def describe(self):
        display(Markdown(f"### {self.name} — โหลดน้ำหนักสำเร็จ ไม่มีการ Train"))
        display(pd.DataFrame([{"โมเดล": self.name, "ชื่อไฟล์": self.weights_path.name,
            "Train": int(self.data["frame"]["split"].eq("train").sum()),
            "Validation": int(self.data["frame"]["split"].eq("val").sum()),
            "Test": int(self.data["frame"]["split"].eq("test").sum()), "ภาพเข้าโมเดล": "224×224"}]).style.hide(axis="index"))
        print("น้ำหนัก:", self.weights_path)
        print("ผลเฉพาะโมเดลนี้:", self.output_dir)
        display(Markdown("ส่วนนี้ประเมินเฉพาะโมเดลจำแนก 6 กลุ่ม ไม่รวมด่าน CLIP; Loss เป็น NLL จากคะแนนของคำตอบจริง "
                         "โดยใช้ class weights เฉพาะเมื่อมี metadata ของโมเดลนี้ระบุไว้"))
        if not self.holdout_verified:
            display(Markdown("**ที่มาของ split:** กำลังประเมินตาม manifest ที่เลือก แต่ยังไม่มี metadata ผูกน้ำหนักนี้กับ split เดิม "
                "จึงยังยืนยันไม่ได้ว่า Test ไม่เคยถูกใช้ฝึกโมเดลนี้ อย่าเรียกผลนี้ว่า Test อิสระที่ยืนยันแล้ว"))

    def evaluate(self, split, use_tta=False):
        if split not in ("train", "val", "test"):
            raise ValueError("split ต้องเป็น train, val หรือ test")
        if legacy_file_hash(self.weights_path) != self.weights_hash:
            raise ValueError("น้ำหนักเปลี่ยน ให้รันขั้นตั้งค่าโมเดลนี้ใหม่")
        frame = self.data["frame"].loc[self.data["frame"]["split"].eq(split)].reset_index(drop=True)
        mode = "six_view_v1" if use_tta else "none"
        cache_key = {**self.identity, "split": split, "mode": mode}
        prefix = self.output_dir / f"{split}_{mode}"
        scores_path, key_path = Path(str(prefix) + "_scores.npz"), Path(str(prefix) + "_cache.json")
        expected = frame["class"].map({name:i for i,name in enumerate(self.class_names)}).to_numpy()
        hit = scores_path.exists() and key_path.exists() and json.loads(key_path.read_text(encoding="utf-8")) == cache_key
        if hit:
            with np.load(scores_path, allow_pickle=False) as saved:
                probabilities, targets, paths = saved["scores"], saved["targets"], saved["paths"]
            if paths.tolist() != frame["zip_path"].tolist():
                raise ValueError("ลำดับภาพใน cache ไม่ตรงกับ split")
        else:
            dataset = LegacyCheckpointDataset(frame, self.data["data_root"], self.transform, self.class_names, use_tta)
            loader = DataLoader(dataset, batch_size=self.batch_size, shuffle=False, num_workers=0,
                                pin_memory=self.device.type == "cuda")
            all_scores, all_targets = [], []
            self.model.to(self.device).eval()
            with torch.inference_mode():
                for views, labels in tqdm(loader, desc=f"{self.name} / {split} / {mode}"):
                    view_scores = [torch.softmax(self.model(views[:, index].to(self.device)).float(), dim=1).cpu()
                                   for index in range(views.shape[1])]
                    all_scores.append(torch.stack(view_scores).mean(dim=0).numpy())
                    all_targets.extend(labels.tolist())
            probabilities, targets = np.concatenate(all_scores), np.asarray(all_targets, dtype=np.int64)
            np.savez_compressed(scores_path, scores=probabilities, targets=targets,
                                paths=np.asarray(frame["zip_path"].tolist(), dtype=str))
            key_path.write_text(json.dumps(cache_key, indent=2), encoding="utf-8")
        if not np.array_equal(targets, expected):
            raise ValueError("คำตอบในผลประเมินไม่ตรงกับ manifest")
        metrics, report = calculate_report_metrics(targets, probabilities, self.class_names, self.class_weights)
        (Path(str(prefix) + "_metrics.json")).write_text(json.dumps(metrics, indent=2), encoding="utf-8")
        predictions = frame[["zip_path", "class", "group6", "md5"]].copy()
        predictions["true_index"], predictions["pred_index"] = targets, probabilities.argmax(axis=1)
        predictions["pred_class"] = [self.class_names[index] for index in probabilities.argmax(axis=1)]
        for index, name in enumerate(self.class_names):
            predictions[f"score_{name}"] = probabilities[:, index]
        predictions.to_csv(str(prefix) + "_predictions.csv", index=False)
        result = {"metrics": metrics, "report": report, "probabilities": probabilities,
                  "targets": targets, "prefix": prefix, "cache_hit": hit}
        self.results[(split, bool(use_tta))] = result
        return result

    def show(self, split, use_tta=False):
        result = self.evaluate(split, use_tta)
        mode = "TTA 6 แบบ" if use_tta else "ภาพเดียว / ไม่ใช้ TTA"
        label = {"train":"Train — ประเมินน้ำหนักที่ฝึกแล้ว", "val":"Validation", "test":"Test ตาม split ที่เลือก"}[split]
        title = f"{self.name} / {split} / {'six-view TTA' if use_tta else 'single image'}"
        display(Markdown(f"### {self.name}: {label} — {mode}"))
        display(report_overall_table({f"{label} — {mode}": result["metrics"]}).style.hide(axis="index"))
        legacy_render_overall(result["metrics"], title, result["prefix"])
        render_classification_report(result["report"], self.class_names, LEGACY_THAI_NAMES, title, result["prefix"])
        render_confusion_report(result["targets"], result["probabilities"].argmax(1), self.class_names, title, result["prefix"])
        if split == "train":
            display(Markdown("ค่าชุด Train ด้านบนเป็น **การประเมิน checkpoint หลังฝึก** ใช้ภาพคงที่ ไม่ใช่ Loss/Accuracy ระหว่างแต่ละ Epoch และไม่มีการปรับน้ำหนัก"))
        if result["metrics"]["clipped_zero_true_scores"]:
            print("Loss จำกัดค่าคะแนนศูนย์ก่อน log:", result["metrics"]["clipped_zero_true_scores"], "ภาพ")
        return result

    def show_history(self):
        if self.history_path and Path(self.history_path).is_file():
            history = (pd.DataFrame(json.loads(Path(self.history_path).read_text(encoding="utf-8")))
                       if Path(self.history_path).suffix.lower() == ".json" else pd.read_csv(self.history_path))
            origin = str(self.history_path)
        else:
            display(Markdown("**ยังไม่มีประวัติการฝึกแต่ละ Epoch ของโมเดลนี้** `.pth` เก็บน้ำหนัก ไม่ได้เก็บรายการ Loss/Accuracy ย้อนหลัง "
                             "จึงแสดงกราฟค่าประเมิน checkpoint ให้ครบแทน หากมี history.csv เดิม ให้กำหนด HISTORY_PATH ของโมเดลนี้แล้วรันช่องนี้ใหม่"))
            return None
        history = history.rename(columns={"train_acc":"train_accuracy", "val_acc":"val_accuracy", "epoch":"global_epoch"})
        required = ["train_loss", "val_loss", "train_accuracy", "val_accuracy"]
        if not set(required).issubset(history.columns) or history.empty or history[required].isna().any().any():
            raise ValueError("History ต้องมี train_loss, val_loss, train_accuracy/train_acc, val_accuracy/val_acc ครบ")
        if "global_epoch" not in history:
            history["global_epoch"] = np.arange(1, len(history)+1)
        if not np.isfinite(history[required].to_numpy(dtype=float)).all():
            raise ValueError("History มีค่าที่ไม่เป็นตัวเลขปกติ")
        if (history[["train_accuracy", "val_accuracy"]].lt(0).any().any()
                or history[["train_accuracy", "val_accuracy"]].gt(1).any().any()):
            raise ValueError("Accuracy ใน history ต้องเป็นสัดส่วน 0 ถึง 1 ไม่ใช่ 0 ถึง 100")
        linked = (self.metadata.get("weights_sha256") == self.weights_hash
                  and bool(self.metadata.get("history_sha256")) and self.history_path
                  and Path(self.history_path).is_file()
                  and legacy_file_hash(self.history_path) == self.metadata["history_sha256"])
        title = "Training history linked to checkpoint" if linked else "Historical training record (checkpoint not verified)"
        display(Markdown(f"**ประวัติ Epoch แยกจากค่าประเมิน checkpoint** — แหล่งข้อมูล: {origin}"))
        if not linked:
            display(Markdown("กราฟนี้เป็นประวัติจริงจากแหล่งที่ระบุ แต่ **ยังไม่ยืนยันว่าเป็นประวัติของ `.pth` ปัจจุบัน** ไม่ใช้กราฟนี้แทนผลประเมินน้ำหนักที่โหลด"))
        fig, axes = plt.subplots(1, 2, figsize=(12, 4))
        for axis, metric, scale in [(axes[0],"loss",1),(axes[1],"accuracy",100)]:
            axis.plot(history["global_epoch"], history[f"train_{metric}"]*scale, label="Train")
            axis.plot(history["global_epoch"], history[f"val_{metric}"]*scale, label="Validation")
            axis.set(xlabel="Epoch", title=metric, ylabel="Score (%)" if metric=="accuracy" else "Loss")
            axis.grid(alpha=0.2)
            axis.legend()
        fig.suptitle(title)
        fig.tight_layout()
        fig.savefig(self.output_dir / "historical_learning_curves.png", dpi=150)
        plt.show()
        plt.close(fig)
        history.to_csv(self.output_dir / "historical_training_history.csv", index=False)
        (self.output_dir / "history_provenance.json").write_text(json.dumps(
            {"source":origin,"linked_to_checkpoint":bool(linked)},ensure_ascii=False,indent=2),encoding="utf-8")
        display(history.style.hide(axis="index").format({key:"{:.4f}" for key in required}))
        return history

    def summary(self, use_tta=True):
        required = [("train",False),("val",bool(use_tta)),("test",bool(use_tta))]
        if any(key not in self.results for key in required):
            raise RuntimeError("รันผล Train, Validation และ Test ของโมเดลนี้ให้ครบก่อนสรุป")
        summary = {f"{split} — {'TTA 6 แบบ' if mode else 'ภาพเดียว'}": self.results[(split,mode)]["metrics"] for split,mode in required}
        display(Markdown(f"### สรุปเฉพาะ {self.name} — ไม่รวมคะแนนกับโมเดลอื่น"))
        display(report_overall_table(summary).style.hide(axis="index"))
        display(Markdown("Train ในตารางนี้เป็นผลประเมิน checkpoint แบบภาพเดียว ไม่ใช่ประวัติระหว่างฝึก; Validation/Test ใช้โหมดตามชื่อแถว"))
        pd.DataFrame(summary).T.to_csv(self.output_dir / f"summary_{'tta' if use_tta else 'single'}.csv")
        return summary

    def predict_image(self, image, use_tta=True):
        if legacy_file_hash(self.weights_path) != self.weights_hash:
            raise ValueError("น้ำหนักเปลี่ยน ให้โหลดโมเดลนี้ใหม่")
        views = legacy_make_views(image, use_tta)
        self.model.to(self.device).eval()
        with torch.inference_mode():
            scores = [torch.softmax(self.model(self.transform(view).unsqueeze(0).to(self.device)).float(), dim=1)[0].cpu()
                      for view in views]
            mean_scores = torch.stack(scores).mean(dim=0).numpy()
        return pd.DataFrame({"class":self.class_names,
                             "ชื่อกลุ่ม":[LEGACY_THAI_NAMES[name] for name in self.class_names],
                             "score":mean_scores, "เปอร์เซ็นต์":mean_scores*100}).sort_values("score",ascending=False).reset_index(drop=True)

    def export(self):
        if legacy_file_hash(self.weights_path) != self.weights_hash:
            raise ValueError("น้ำหนักเปลี่ยน ให้โหลดและประเมินใหม่ก่อนส่งออก")
        destination = self.output_dir / f"{self.architecture}_evaluation.zip"
        with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.write(self.data["split_path"], "manifest_split.csv")
            for path in sorted(self.output_dir.iterdir()):
                if path.is_file() and path.suffix != ".zip":
                    archive.write(path, path.name)
        print("ZIP รายงานเฉพาะ", self.name, ":", destination)
        return destination
