"""Per-request writing directions; recent answers come only from the caller's session."""
import re
import secrets
import unicodedata

STYLES = (
    "เริ่มแต่ละข้อด้วยสิ่งที่เจ้าของทำหรือสังเกตได้ทันที ใช้ภาษาพูดสุภาพ กระชับ",
    "เน้นการจดติดตามความเปลี่ยนแปลง ใช้สำนวนชวนสังเกตทีละขั้น",
    "เน้นกิจวัตรดูแลที่ทำได้ง่าย แล้วบอกสิ่งที่ควรเฝ้าดูด้วยสำนวนใหม่",
    "เน้นเปรียบเทียบอาการวันนี้กับวันก่อน อธิบายแบบเป็นมิตรและตรงประเด็น",
    "ใช้คำชวนตรวจดูบริเวณผิวและพฤติกรรม แล้วเชื่อมกับการดูแลอย่างอ่อนโยน",
    "เน้นเตรียมข้อมูลสำหรับเล่าให้สัตวแพทย์ พร้อมสรุปการดูแลและข้อควรเลี่ยงอย่างเข้าใจง่าย",
)


def writing_style(index=None):
    return STYLES[secrets.randbelow(len(STYLES)) if index is None else index]


def normalize_previous(raw):
    """Bound untrusted recent output; never share it through a server-wide cache."""
    if raw is None:
        return None
    if not isinstance(raw, dict) or set(raw) - {"items", "tips"}:
        raise ValueError("รูปแบบคำแนะนำก่อนหน้าไม่ถูกต้อง")
    result = {}
    for field, minimum in (("items", 3), ("tips", 1)):
        if field not in raw:
            continue
        values = raw[field]
        if (not isinstance(values, list) or not minimum <= len(values) <= 3
                or any(not isinstance(v, str) or not 0 < len(v.strip()) <= 220 for v in values)):
            raise ValueError("รูปแบบคำแนะนำก่อนหน้าไม่ถูกต้อง")
        result[field] = [v.strip() for v in values]
    return result or None


def canonical(text):
    return re.sub(r"[\W_]+", "", unicodedata.normalize("NFC", text)).casefold()


def repeats(items, previous):
    """Catch reused whole items or substantial openings, including whitespace edits."""
    old = [canonical(item) for item in previous]
    for item in items:
        current = canonical(item)
        if any(current == past or (len(current) >= 24 and len(past) >= 24 and current[:24] == past[:24]) for past in old):
            return True
    return False
