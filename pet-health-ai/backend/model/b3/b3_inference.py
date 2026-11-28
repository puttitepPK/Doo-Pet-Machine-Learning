"""Load the evaluated B3 checkpoint with its original Colab preprocessing."""

import hashlib
import json
import math
from pathlib import Path

import torch
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
from torch import nn
from torchvision import models, transforms
from torchvision.transforms import InterpolationMode


# ตั้งค่าโหมด B3 สำหรับหน้าเว็บ แล้วรีสตาร์ต API:
# True = เปิด TTA ตาม recipe ใน metadata ของ B3, False = ใช้ภาพเดียว
B3_TTA_OVERRIDE = True  

B3_NEWADD5_TTA_VIEWS = ["identity", "hflip", "rot-10", "rot+10", "hflip_rot-10", "hflip_rot+10"]
B3_LEGACY_TTA_RECIPE = "legacy_enhance_v1"
B3_NEWADD5_TTA_RECIPE = "newadd5_rotation_v1"


def get_b3_tta_recipe(metadata):
    """Use the evaluated view recipe; older checkpoints retain their original recipe."""
    views = metadata.get("tta_views")
    if views is None:
        return B3_LEGACY_TTA_RECIPE
    if views == B3_NEWADD5_TTA_VIEWS:
        return B3_NEWADD5_TTA_RECIPE
    raise ValueError("Unsupported B3 tta_views in checkpoint metadata")

# โหลดโมเดล B3 ที่ประเมินแล้วและตรวจสอบความถูกต้องของน้ำหนักและเมตาดาต้า
def load_b3_model(model_dir, device, expected_classes):
    model_dir = Path(model_dir)
    weights_path = model_dir / "efficientnet_b3_model.pth"
    metadata_path = model_dir / "efficientnet_b3_metadata.json"
    # JSON เป็นคู่มือกำกับ ส่วน .pth เป็นน้ำหนัก; ต้องใช้คู่ที่ตรงกัน
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))

    if metadata.get("architecture") != "efficientnet_b3":
        raise ValueError("B3 metadata must identify the efficientnet_b3 architecture")
    # เทียบลำดับกลุ่มกับ main.py เพื่อไม่ให้คะแนนถูกแปลเป็นชื่อกลุ่มผิด
    classes = list(expected_classes)
    if metadata.get("class_names") != classes:
        raise ValueError("B3 class order does not match the API class order")
    if metadata.get("class_to_idx") != {name: index for index, name in enumerate(classes)}:
        raise ValueError("B3 class_to_idx does not match the API class mapping")
    if metadata.get("num_classes") != len(classes):
        raise ValueError("B3 metadata has a different number of classes")
    get_b3_tta_recipe(metadata)

    preprocessing = metadata["preprocessing"]
    if (preprocessing.get("color_mode") != "RGB"
            or preprocessing.get("exif_transpose") is not True
            or preprocessing.get("interpolation") != "bicubic"
            or preprocessing.get("tta") is not False):
        raise ValueError("Unsupported B3 preprocessing; keep it aligned with the evaluated notebook")
    resize = preprocessing["resize_shorter_side"]
    crop = preprocessing["center_crop"]
    if not isinstance(resize, int) or not isinstance(crop, int) or not 0 < crop <= resize:
        raise ValueError("Invalid B3 resize or crop size")
    mean, std = preprocessing["mean"], preprocessing["std"]
    if (len(mean) != 3 or len(std) != 3
            or not all(math.isfinite(value) for value in [*mean, *std])
            or not all(value > 0 for value in std)):
        raise ValueError("Invalid B3 normalization")

    # SHA-256 ตรวจว่าไฟล์น้ำหนักตรงกับ metadata; ถ้าไม่ตรงจะหยุดโหลดด้วยข้อผิดพลาด
    expected_hash = metadata.get("weights_sha256")
    if not expected_hash:
        raise ValueError("B3 metadata must include the SHA-256 of the evaluated weights")
    digest = hashlib.sha256()
    with weights_path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    if digest.hexdigest() != expected_hash:
        raise ValueError("B3 weights do not match the evaluated checkpoint in its metadata")

    # สร้างโครงสร้างเปล่าก่อน แล้วใส่น้ำหนักจาก .pth ในคำสั่ง load_state_dict ด้านล่าง
    model = models.efficientnet_b3(weights=None)
    model.classifier[1] = nn.Linear(model.classifier[1].in_features, len(classes))
    model.load_state_dict(torch.load(weights_path, map_location="cpu", weights_only=True), strict=True) # บรรทัดที่อ่าน .pth จริง ๆ คือ torch.load(...)
    # eval ตั้งพฤติกรรมชั้นโมเดลสำหรับทำนาย; main.py ใช้ no_grad ตอนคำนวณอีกชั้นหนึ่ง
    model = model.to(device).eval()
    # ใช้ค่าใน metadata: ด้านสั้น 320 → ตัดกลาง 300×300 → Tensor → Normalize
    preprocessing_transform = transforms.Compose([
        transforms.Resize(resize, interpolation=InterpolationMode.BICUBIC),
        transforms.CenterCrop(crop),
        transforms.ToTensor(),
        transforms.Normalize(mean=mean, std=std),
    ])
    # main.py รับไปเก็บใน model_efficientnet_b3, b3_transforms และ b3_metadata ตามลำดับ
    return model, preprocessing_transform, metadata

# 	ปรับแสงและความคมเบื้องต้น
def enhance_b3_image(image):
    """Use the same lighting and sharpness adjustments as the existing B0 pipeline."""
    image = image.convert("RGB")
    pixels = list(image.convert("L").getdata())
    brightness = sum(pixels) / max(len(pixels), 1)
    image = ImageOps.autocontrast(image, cutoff=1)
    if brightness < 90:
        factor = min(1.6, max(1.15, 115.0 / max(brightness, 1.0)))
        image = ImageEnhance.Brightness(image).enhance(factor)
        image = ImageEnhance.Contrast(image).enhance(1.25)
    elif brightness > 200:
        image = ImageEnhance.Brightness(image).enhance(0.82)
        image = ImageEnhance.Contrast(image).enhance(1.2)
    return ImageEnhance.Sharpness(image).enhance(1.5)

# NewAdd5 ใช้ flip/หมุนตาม Colab; checkpoint เดิมที่ไม่มี tta_views ใช้ recipe ปรับแสงเดิม
def build_b3_views(image, use_tta=False, tta_recipe=B3_LEGACY_TTA_RECIPE):
    """Create the exact PIL views evaluated for the selected B3 checkpoint."""
    if tta_recipe not in (B3_LEGACY_TTA_RECIPE, B3_NEWADD5_TTA_RECIPE):
        raise ValueError("Unsupported B3 TTA recipe")
    image = ImageOps.exif_transpose(image).convert("RGB")
    # Single ใช้ภาพเดียว; ถ้าเปิด TTA จึงสร้างหลายมุมเพื่อเฉลี่ยคะแนน ไม่ได้ฝึกเพิ่ม
    if not use_tta:
        return [image]
    if tta_recipe == B3_NEWADD5_TTA_RECIPE:
        minus = image.rotate(-10, resample=Image.Resampling.BILINEAR)
        plus = image.rotate(10, resample=Image.Resampling.BILINEAR)
        return [image, ImageOps.mirror(image), minus, plus,
                ImageOps.mirror(minus), ImageOps.mirror(plus)]
    width, height = image.size
    enhanced = enhance_b3_image(image)
    crop_box = (int(width * 0.12), int(height * 0.12),
                int(width * 0.88), int(height * 0.88))
    cropped = enhanced.crop(crop_box) if width > 64 and height > 64 else enhanced
    sharpened = enhanced.filter(ImageFilter.SHARPEN)
    brighter = ImageEnhance.Contrast(ImageEnhance.Brightness(enhanced).enhance(1.2)).enhance(1.2)
    return [image, enhanced, cropped, sharpened, brighter, ImageOps.mirror(enhanced)]

# เตรียมภาพทั้งหมดให้เข้า B3 	เตรียมแต่ละภาพเป็น Tensor ขนาด 300×300 สำหรับ B3
def build_b3_batch(image: Image.Image, preprocessing_transform, device, use_tta=False,
                   tta_recipe=B3_LEGACY_TTA_RECIPE):
    """Prepare checkpoint-specific views with B3's own 300x300 transform."""
    # เตรียม Tensor รวมทุกมุม แล้วส่งกลับให้ main.py นำเข้าโมเดล B3
    views = build_b3_views(image, use_tta=use_tta, tta_recipe=tta_recipe)
    return torch.stack([preprocessing_transform(view) for view in views]).to(device)


def get_b3_tta_default(metadata):
    """Use a Validation-selected policy; historical preprocessing metadata stays unchanged."""
    policy = metadata.get("inference")
    if policy is None:
        return False
    if policy.get("tta_mode") not in ("none", "six_view_v1"):
        raise ValueError("Unsupported B3 TTA policy")
    if (policy.get("selection_dataset") != "val"
            or policy.get("weights_sha256") != metadata.get("weights_sha256")
            or policy.get("split_sha256") != metadata["dataset"]["split_sha256"]
            or policy.get("images") != metadata["dataset"]["split_counts"]["val"]):
        raise ValueError("B3 TTA recommendation must match this checkpoint and Validation split")
    comparison = policy["validation_comparison"]
    single_f1 = comparison["none"]["macro_f1"]
    tta_f1 = comparison["six_view_v1"]["macro_f1"]
    if not all(isinstance(value, (int, float)) and math.isfinite(value) and 0 <= value <= 1
               for value in (single_f1, tta_f1)):
        raise ValueError("Invalid Validation scores for B3 TTA")
    recommended = tta_f1 > single_f1 + 1e-6
    if (policy["tta_mode"] == "six_view_v1") != recommended:
        raise ValueError("B3 TTA policy disagrees with its Validation Macro F1 comparison")
    return recommended
