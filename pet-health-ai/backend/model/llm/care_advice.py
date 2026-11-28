"""Generate care advice with optional owner context and deterministic fallbacks."""
import json
import logging
from threading import BoundedSemaphore
from time import monotonic
from urllib.error import HTTPError

from .config import ADVICE_CONCURRENCY, ADVICE_TIMEOUT, MAX_TIPS, get_api_key
from .care_context import fallback_tips, tip_validation_reason, valid_tip
from .gemini_client import generate_json
from .prompts import build_advice_prompt
from .variation import canonical, repeats, writing_style

logger = logging.getLogger(__name__)
requests = BoundedSemaphore(ADVICE_CONCURRENCY)

OPTIONS = {
    "bacterial_dermatosis": (
        ("ดูว่ามีตุ่มหนอง สะเก็ด รอยแดง หรือกลิ่นผิดปกติเพิ่มขึ้นไหม", "สังเกตว่ารอยแดงลามหรือมีตุ่มหนองเพิ่มหรือไม่",),
        ("ลดการเลียและเกาบริเวณที่ระคายเคือง ถ้ามีหนองหรือรอยลาม ให้สัตวแพทย์ตรวจเพื่อเลือกการรักษา", "ลดการเลียและเกาบริเวณที่ระคายเคือง ถ้ามีหนองหรือรอยลาม ควรให้สัตวแพทย์ตรวจเพื่อเลือกการรักษา",),
        ("หลีกเลี่ยงการบีบตุ่ม แกะสะเก็ด และขัดถูผิวหนังแรง ๆ",),
    ),
    "demodicosis": (
        ("ดูว่าขนร่วงเป็นหย่อม ผิวแดง หรือมีขุยเพิ่มขึ้นไหม", "สังเกตว่าขนร่วงลามหรือเริ่มมีหย่อมใหม่ไหม",),
        ("ลดการเกาบริเวณที่ระคายเคือง หากรอยขยายหรือมีหลายจุด ให้สัตวแพทย์ตรวจยืนยันและเลือกวิธีรักษา", "ลดการเกาบริเวณที่ระคายเคือง ถ้ารอยขยายหรือมีหลายจุด ควรให้สัตวแพทย์ตรวจยืนยันและเลือกวิธีรักษา",),
        ("หลีกเลี่ยงการแกะสะเก็ดและขัดถูบริเวณที่ขนร่วงหรือระคายเคือง",),
    ),
    "dermatitis": (
        ("ดูว่ารอยแดงลาม มีน้ำซึม หรือน้องเลียและเกาบ่อยขึ้นไหม", "จดว่าเริ่มคันหรือแดงเมื่อไหร่ และช่วงนั้นมีผลิตภัณฑ์ใหม่หรือไม่",),
        ("ลดการเลียเกาบริเวณที่ระคายเคือง หากผิวเจ็บ มีน้ำซึม หรือรอยลาม ควรพาไปตรวจหาสาเหตุ", "ลดการเลียเกาบริเวณที่ระคายเคือง ถ้าผิวเจ็บ มีน้ำซึม หรือรอยลาม ควรพาไปตรวจหาสาเหตุ",),
        ("หลีกเลี่ยงผลิตภัณฑ์ที่เพิ่งใช้แล้วเริ่มมีอาการ และงดขัดถูผิวบริเวณที่แดง",),
    ),
    "fungal_infection": (
        ("สังเกตว่ามีขนร่วงเป็นหย่อม ผิวเป็นขุย หรือมีจุดใหม่เพิ่มไหม", "ดูว่าหย่อมขนร่วงและสะเก็ดขยายออกจากเดิมหรือไม่",),
        ("ล้างมือหลังสัมผัสบริเวณรอยโรค และพาไปตรวจยืนยันเพื่อให้สัตวแพทย์เลือกวิธีรักษา",),
        ("ระหว่างรอตรวจ เลี่ยงการใช้แปรงหรือผ้าร่วมกับสัตว์ตัวอื่น เพราะเชื้อราบางชนิดแพร่ผ่านการสัมผัสได้",),
    ),
    "healthy": (
        ("สังเกตว่าน้องกลับมาเกา เลีย หรือมีขนร่วงผิดปกติไหม", "ดูว่ามีรอยแดง ขุย หรือเลียจุดเดิมบ่อยหรือไม่",),
        ("ดูแลตามกิจวัตร หากยังคันหรือมีอาการต่อเนื่อง ให้พาไปตรวจตามอาการ", "ดูแลตามกิจวัตร ถ้ายังคันหรือมีอาการต่อเนื่อง ควรให้พาไปตรวจตามอาการ",),
        ("หลีกเลี่ยงการขัดถูผิวหนังแรง ๆ หรือเกาจุดเดิมซ้ำ ๆ",),
    ),
    "hypersensitivity": (
        ("จดว่าน้องคันตรงไหน คันช่วงไหน และมีอะไรเปลี่ยนไปก่อนเริ่มคัน", "สังเกตว่าอาการคันเกิดซ้ำหลังสัมผัสผลิตภัณฑ์หรือสิ่งแวดล้อมบางอย่างไหม",),
        ("ลดการเลียเกาและจดสิ่งที่สงสัยว่ากระตุ้นอาการ หากคันซ้ำหรือเกาจนเป็นแผล ให้สัตวแพทย์ประเมิน", "ลดการเลียเกาและจดสิ่งที่สงสัยว่ากระตุ้นอาการ ถ้าคันซ้ำหรือเกาจนเป็นแผล ควรให้สัตวแพทย์ประเมิน",),
        ("เลี่ยงสิ่งที่สังเกตว่ากระตุ้นอาการ และงดขัดถูผิวบริเวณที่ระคายเคือง",),
    ),
}


def fallback_log(category, reason, *, section="all", status=None):
    # Only fixed codes and numeric status: never log keys, prompts, owner data or response bodies.
    logger.warning("Gemini fallback category=%s reason=%s section=%s%s", category, reason, section,
                   f" http_status={status}" if status is not None else "")


def log_text_rejections(values, section):
    if isinstance(values, list):
        for value in values:
            reason = tip_validation_reason(value)
            if reason:
                fallback_log("validation", reason, section=section)


def care_advice(label: str, *, score=None, context=None, previous=None, variation_index=None, opener=None, api_key=None) -> dict:
    groups = OPTIONS[label]
    fallback = {"items": [group[0] for group in groups], "source": "fallback"}
    if context:
        fallback["context_tips"] = {"items": fallback_tips(context), "source": "fallback"}
    api_key = get_api_key(api_key)
    if not api_key:
        fallback_log("configuration", "missing_api_key")
        return fallback
    if not requests.acquire(blocking=False):
        fallback_log("capacity", "concurrency_limit")
        return fallback

    best = dict(fallback)
    try:
        properties = {
            "items": {"type": "array", "minItems": 3, "maxItems": 3,
                      "items": {"type": "string", "maxLength": 220}},
        }
        if context:
            properties["tips"] = {"type": "array", "minItems": 1, "maxItems": MAX_TIPS,
                                  "items": {"type": "string", "maxLength": 160}}
        prompt = build_advice_prompt(label, score, context, guidelines=groups,
                                    style=writing_style(variation_index), previous=previous)
        body = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "maxOutputTokens": 1024,
                "temperature": 0.3,
                "responseMimeType": "application/json",
                "responseJsonSchema": {
                    "type": "object",
                    "properties": properties,
                    "required": list(properties),
                },
            },
        }
        deadline = monotonic() + ADVICE_TIMEOUT
        for attempt in range(2):
            remaining = deadline - monotonic()
            if remaining <= 0:
                fallback_log("provider", "timeout_budget")
                return best
            result = generate_json(body, api_key=api_key, timeout=remaining, opener=opener)
            if not isinstance(result, dict):
                fallback_log("response", "missing_or_invalid_object")
                return best
            advice = dict(best)
            items = result.get("items")
            valid_items = (isinstance(items, list) and len(items) == 3 and all(valid_tip(item) for item in items)
                           and len({canonical(item) for item in items}) == 3)
            repeated_items = valid_items and previous and repeats(items, previous.get("items", []))
            if valid_items and not repeated_items:
                advice.update(items=[item.strip() for item in items], source="gemini")
            else:
                fallback_log("validation", "repeated_items" if repeated_items else "invalid_items", section="items")
                if not valid_items:
                    log_text_rejections(items, "items")
            repeated_tips = False
            if context:
                tips = result.get("tips")
                valid_tips = isinstance(tips, list) and 1 <= len(tips) <= MAX_TIPS and all(valid_tip(tip) for tip in tips)
                repeated_tips = valid_tips and (repeats(tips, advice["items"])
                                               or repeats(tips, (previous or {}).get("tips", []))
                                               or len({canonical(tip) for tip in tips}) != len(tips))
                if valid_tips and not repeated_tips:
                    advice["context_tips"] = {"items": [tip.strip() for tip in tips], "source": "gemini"}
                else:
                    fallback_log("validation", "repeated_tips" if repeated_tips else "invalid_tips", section="context_tips")
                    if not valid_tips:
                        log_text_rejections(tips, "context_tips")
                # A retained tip from a previous attempt must still add detail to the displayed items.
                if advice["context_tips"]["source"] == "gemini" and repeats(advice["context_tips"]["items"], advice["items"]):
                    advice["context_tips"] = fallback["context_tips"]
            best = advice
            # Rewrite a duplicated response once, within the same total timeout budget.
            if attempt == 0 and (repeated_items or repeated_tips):
                body["contents"].extend([
                    {"role": "model", "parts": [{"text": json.dumps(result, ensure_ascii=False)}]},
                    {"role": "user", "parts": [{"text": "คำตอบยังซ้ำกับข้อความก่อนหน้าหรือ tips ซ้ำกับ items โปรดเขียนใหม่ เปลี่ยนประโยคเปิดและข้อความทั้งข้อ โดยคงแนวทางสำคัญและข้อมูลเดิม ห้ามกล่าวถึงยาแม้เป็นคำเตือนหรือข้อห้าม ให้ใช้คำแนะนำดูแลที่ไม่เกี่ยวกับยาแทน ตอบ JSON ตาม schema เดิม"}]},
                ])
                continue
            return advice
    except HTTPError as error:
        fallback_log("provider", "http_error", status=error.code)
    except (TimeoutError, OSError):
        fallback_log("provider", "timeout_or_network_error")
    except (ValueError, KeyError, IndexError, TypeError):
        fallback_log("response", "invalid_json_or_payload")
    finally:
        requests.release()

    return best
