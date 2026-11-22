"""Optional owner-provided context for a check ("ข้อมูลประกอบการตรวจ").

The image model never sees this data: it only feeds the care-advice text.
Values are stable codes; Thai labels are for display/prompting only.
"""
import re
import unicodedata

VERSION = 1
NOTES_MAX = 500

FIELDS = {
    "symptoms": {
        "multi": True,
        "exclusive": {"unsure"},
        "labels": {"itching": "คัน", "licking_scratching": "เลียหรือเกาบ่อย", "hair_loss": "ขนร่วง", "redness": "ผิวแดง", "unsure": "ไม่แน่ใจ"},
    },
    "duration": {
        "multi": False,
        "labels": {"today": "วันนี้", "2_3_days": "2–3 วัน", "about_1_week": "ประมาณหนึ่งสัปดาห์", "longer": "นานกว่านั้น", "unknown": "ไม่ทราบ"},
    },
    "body_sites": {
        "multi": True,
        "exclusive": {"multiple"},
        "labels": {"face": "หน้า", "ears": "หู", "body": "ลำตัว", "abdomen": "ท้อง", "legs_paws": "ขาและอุ้งเท้า", "multiple": "หลายจุด"},
    },
    "living_environment": {
        "multi": False,
        "labels": {"indoor": "ในบ้าน", "outdoor": "นอกบ้าน", "both": "ทั้งสองแบบ", "unknown": "ไม่ทราบ"},
    },
    "recent_changes": {
        "multi": True,
        "exclusive": {"none", "unknown"},
        "labels": {"food": "อาหาร", "shampoo": "แชมพู", "bedding": "ที่นอน", "play_area": "สถานที่ไปเล่น", "none": "ไม่มี", "unknown": "ไม่ทราบ"},
    },
}
ALLOWED_KEYS = {"version", "notes", *FIELDS}
_CONTROL = re.compile("[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\\u200b-\\u200f\\u202a-\\u202e\\u2066-\\u2069]")


class OwnerContextError(ValueError):
    """Raised with a Thai message when the submitted context is malformed."""


def clean_notes(value):
    if value is None:
        return None
    if not isinstance(value, str):
        raise OwnerContextError("บันทึกเพิ่มเติมต้องเป็นข้อความ")
    text = _CONTROL.sub("", unicodedata.normalize("NFC", value)).replace("\r\n", "\n").replace("\r", "\n").strip()
    if len(text) > NOTES_MAX:
        raise OwnerContextError(f"บันทึกเพิ่มเติมยาวได้ไม่เกิน {NOTES_MAX} ตัวอักษร")
    return text or None


def normalize_owner_context(raw):
    """Return the canonical dict, or None when nothing was answered.

    Unanswered fields are dropped (never read as "no symptoms").
    """
    if raw is None:
        return None
    if not isinstance(raw, dict):
        raise OwnerContextError("ข้อมูลประกอบต้องเป็นออบเจกต์")
    unknown = set(raw) - ALLOWED_KEYS
    if unknown:
        raise OwnerContextError("มีช่องข้อมูลที่ระบบไม่รู้จัก")
    version = raw.get("version", VERSION)
    if version != VERSION or isinstance(version, bool):
        raise OwnerContextError("เวอร์ชันข้อมูลประกอบไม่รองรับ")

    result = {}
    for key, spec in FIELDS.items():
        value = raw.get(key)
        allowed = spec["labels"]
        if value is None:
            continue
        if spec["multi"]:
            if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
                raise OwnerContextError("รูปแบบข้อมูลประกอบไม่ถูกต้อง")
            if any(item not in allowed for item in value):
                raise OwnerContextError("มีค่าที่ไม่อยู่ในตัวเลือก")
            chosen = set(value)
            if not chosen:
                continue
            exclusive = chosen & spec.get("exclusive", set())
            if exclusive and len(chosen) > 1:
                raise OwnerContextError("ตัวเลือก “ไม่มี / ไม่ทราบ / ไม่แน่ใจ / หลายจุด” เลือกร่วมกับข้ออื่นไม่ได้")
            result[key] = [code for code in allowed if code in chosen]
        else:
            if not isinstance(value, str) or value not in allowed:
                raise OwnerContextError("มีค่าที่ไม่อยู่ในตัวเลือก")
            result[key] = value

    notes = clean_notes(raw.get("notes"))
    if notes:
        result["notes"] = notes
    return {"version": VERSION, **result} if result else None


def label(field, code):
    return FIELDS[field]["labels"][code]


def describe(context):
    """Thai, human-readable copy of the structured answers (notes excluded)."""
    if not context:
        return {}
    out = {}
    for key, spec in FIELDS.items():
        if key in context:
            value = context[key]
            out[key] = [spec["labels"][code] for code in value] if spec["multi"] else spec["labels"][value]
    return out
