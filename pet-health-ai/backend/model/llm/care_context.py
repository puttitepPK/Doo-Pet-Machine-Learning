"""Extra observation tips that use the owner's optional context ("ข้อมูลที่เจ้าของระบุ").

Rules: the image result and the owner's answers stay separate; the model scores are never changed;
the LLM may only suggest what to observe/record; owner notes are treated as data, not instructions;
any failure falls back to fixed templates built from the coded answers.
"""
import logging
import re

from .config import CONTEXT_TIMEOUT, MAX_TIPS, TIP_MAX, get_api_key
from .gemini_client import generate_json
from .owner_context import label
from .prompts import build_context_prompt as build_prompt

DISEASE_TH = {
    "bacterial_dermatosis": "โรคผิวหนังจากการติดเชื้อแบคทีเรีย", "demodicosis": "โรคขี้เรื้อนเปียก (ไรขุมขน)",
    "dermatitis": "ผิวหนังอักเสบ", "fungal_infection": "โรคผิวหนังจากเชื้อรา", "healthy": "ผิวหนังปกติ",
    "hypersensitivity": "ภาวะภูมิไวเกิน (อาการแพ้)",
}
logger = logging.getLogger(__name__)

# Claims the tips must never make (diagnosis, cause, contagion, allergy conclusions, dosing, links).
BANNED = re.compile(
    r"แพ้อาหาร|แพ้แชมพู|แพ้ที่นอน|เป็นโรค|ยืนยันว่า|วินิจฉัย|สาเหตุคือ|สาเหตุมาจาก|เกิดจาก|ติดต่อ|ติดเชื้อจาก|ติดมาจาก|"
    r"\d+\s*(มก|มล|mg|ml|ซีซี|เม็ด|cc)|ขนาดยา|ให้ยา|กินยา|ทายา\S*ชื่อ|https?://|www\.",
    re.IGNORECASE,
)
THAI = re.compile(r"[฀-๿]")


def fallback_tips(context):
    """Deterministic tips from the coded answers only (no free text is echoed back)."""
    if not context:
        return []
    tips = []
    changes = [code for code in context.get("recent_changes", []) if code not in ("none", "unknown")]
    if changes:
        names = " ".join(label("recent_changes", code) for code in changes)
        tips.append(f"จดวันที่เปลี่ยน{names} และอาการก่อน–หลังเปลี่ยน ไว้เล่าให้สัตวแพทย์ฟัง ข้อมูลนี้ยังสรุปไม่ได้ว่าเป็นสาเหตุ")
    symptoms = [code for code in context.get("symptoms", []) if code != "unsure"]
    if {"itching", "licking_scratching"} & set(symptoms):
        tips.append("จดว่าน้องคัน เลีย หรือเกาบ่อยแค่ไหนในแต่ละวัน และมักเป็นช่วงเวลาไหน")
    if "hair_loss" in symptoms:
        tips.append("สังเกตว่าบริเวณที่ขนร่วงขยายกว้างขึ้นหรือมีจุดใหม่เพิ่มหรือไม่")
    if "redness" in symptoms:
        tips.append("สังเกตว่ารอยแดงลาม มีน้ำซึม หรือมีกลิ่นผิดปกติเพิ่มขึ้นหรือไม่")
    sites = [code for code in context.get("body_sites", []) if code != "multiple"]
    if sites:
        tips.append(f"ติดตามบริเวณ{' '.join(label('body_sites', code) for code in sites)}เป็นหลัก และดูว่ามีจุดใหม่ที่อื่นหรือไม่")
    elif "multiple" in context.get("body_sites", []):
        tips.append("จดว่าพบอาการที่จุดไหนบ้าง และมีจุดใหม่เพิ่มขึ้นหรือไม่")
    duration = context.get("duration")
    if duration and duration != "unknown":
        tips.append(f"อาการเริ่มมา{label('duration', duration)} ลองจดว่าแต่ละวันอาการดีขึ้น คงที่ หรือแย่ลง")
    if context.get("living_environment") in ("outdoor", "both"):
        tips.append("หลังกลับจากนอกบ้าน สังเกตว่าอาการคันหรือรอยแดงเปลี่ยนไปหรือไม่ และจดสถานที่ที่ไป")
    if not tips:
        tips.append("จดอาการที่เห็นในแต่ละวันสั้น ๆ เพื่อใช้เล่าให้สัตวแพทย์ฟังหากอาการไม่ดีขึ้น")
    return tips[:MAX_TIPS]


def valid_tip(text):
    return isinstance(text, str) and 0 < len(text.strip()) <= TIP_MAX and THAI.search(text) and not BANNED.search(text)


def context_tips(label_code, score, context, *, opener=None, api_key=None):
    """Return {"items": [...], "source": "gemini"|"fallback"} or None when no context was given."""
    if not context:
        return None
    fallback = {"items": fallback_tips(context), "source": "fallback"}
    key = get_api_key(api_key)
    if not key:
        return fallback
    body = {
        "contents": [{"role": "user", "parts": [{"text": build_prompt(label_code, DISEASE_TH.get(label_code, label_code), score, context)}]}],
        "generationConfig": {
            "maxOutputTokens": 512,
            "temperature": 0.3,
            "responseMimeType": "application/json",
            "responseJsonSchema": {
                "type": "object",
                "properties": {"tips": {"type": "array", "minItems": 1, "maxItems": MAX_TIPS, "items": {"type": "string", "maxLength": 160}}},
                "required": ["tips"],
            },
        },
    }
    try:
        result = generate_json(body, api_key=key, timeout=CONTEXT_TIMEOUT, opener=opener)
        if result is None:
            return fallback
        tips = result["tips"]
        if isinstance(tips, list) and 1 <= len(tips) <= MAX_TIPS and all(valid_tip(tip) for tip in tips):
            return {"items": [tip.strip() for tip in tips], "source": "gemini"}
    except (OSError, ValueError, KeyError, IndexError, TypeError):
        logger.warning("Gemini context tips unavailable; using fallback")
    return fallback


__all__ = ["context_tips", "fallback_tips", "valid_tip", "build_prompt", "DISEASE_TH"]
