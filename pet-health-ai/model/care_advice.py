"""Choose short care suggestions with Gemini from a fixed set of options."""
import json
import logging
import os
import random
from itertools import product
from pathlib import Path
from threading import BoundedSemaphore
from urllib.request import Request, urlopen

from dotenv import load_dotenv

MODEL_DIR = Path(__file__).resolve().parent
load_dotenv(MODEL_DIR.parent / ".env.local", override=False)
load_dotenv(MODEL_DIR / ".env.local", override=False)

MODEL = "gemini-3.5-flash-lite"
logger = logging.getLogger(__name__)
requests = BoundedSemaphore(2)

OPTIONS = {
    "bacterial_dermatosis": (
        ("ดูว่ามีตุ่มหนอง สะเก็ด รอยแดง หรือกลิ่นผิดปกติเพิ่มขึ้นไหม", "สังเกตว่ารอยแดงลามหรือมีตุ่มหนองเพิ่มหรือไม่",),
        ("ลดการเลียและเกาบริเวณที่ระคายเคือง ถ้ามีหนองหรือรอยลาม ให้สัตวแพทย์ตรวจเพื่อเลือกการรักษา", "ลดการเลียและเกาบริเวณที่ระคายเคือง ถ้ามีหนองหรือรอยลาม ควรให้สัตวแพทย์ตรวจเพื่อเลือกการรักษา",),
        ("หลีกเลี่ยงการบีบตุ่ม แกะสะเก็ด และใช้ยาปฏิชีวนะที่เหลือเอง",),
    ),
    "demodicosis": (
        ("ดูว่าขนร่วงเป็นหย่อม ผิวแดง หรือมีขุยเพิ่มขึ้นไหม", "สังเกตว่าขนร่วงลามหรือเริ่มมีหย่อมใหม่ไหม",),
        ("ลดการเกาบริเวณที่ระคายเคือง หากรอยขยายหรือมีหลายจุด ให้สัตวแพทย์ตรวจยืนยันและเลือกวิธีรักษา", "ลดการเกาบริเวณที่ระคายเคือง ถ้ารอยขยายหรือมีหลายจุด ควรให้สัตวแพทย์ตรวจยืนยันและเลือกวิธีรักษา",),
        ("หลีกเลี่ยงการซื้อยากำจัดไรหรือใช้แชมพูยาด้วยตัวเอง",),
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
        ("หลีกเลี่ยงการทายาหรือใช้แชมพูยาเองหากสัตวแพทย์ยังไม่ได้แนะนำ",),
    ),
    "hypersensitivity": (
        ("จดว่าน้องคันตรงไหน คันช่วงไหน และมีอะไรเปลี่ยนไปก่อนเริ่มคัน", "สังเกตว่าอาการคันเกิดซ้ำหลังสัมผัสผลิตภัณฑ์หรือสิ่งแวดล้อมบางอย่างไหม",),
        ("ลดการเลียเกาและจดสิ่งที่สงสัยว่ากระตุ้นอาการ หากคันซ้ำหรือเกาจนเป็นแผล ให้สัตวแพทย์ประเมิน", "ลดการเลียเกาและจดสิ่งที่สงสัยว่ากระตุ้นอาการ ถ้าคันซ้ำหรือเกาจนเป็นแผล ควรให้สัตวแพทย์ประเมิน",),
        ("เลี่ยงสิ่งที่สังเกตว่ากระตุ้นอาการ และอย่าให้ยาแก้แพ้ของคนเอง",),
    ),
}


def care_advice(label: str) -> dict:
    groups = OPTIONS[label]
    choices = list(product(*groups))
    fallback = {"items": [group[0] for group in groups], "source": "fallback"}
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key or not requests.acquire(blocking=False):
        return fallback

    try:
        random.shuffle(choices)
        body = {
            "contents": [{"parts": [{"text": (
                f"จัดข้อความดูแลผิวหนังสุนัขเบื้องต้นสำหรับผลคัดกรอง {label} "
                "เลือกชุดคำแนะนำตามลำดับ อาการที่ควรสังเกต วิธีดูแลเบื้องต้น และสิ่งที่ควรหลีกเลี่ยง ห้ามขอให้ถ่ายหรือส่งรูปใหม่ ห้ามยืนยันโรค สั่งยา หรือระบุขนาดยา "
                "ตอบดัชนีของชุดเพียงค่าเดียว เริ่มจาก 0\n" +
                "\n".join(f"{index}: " + " | ".join(items) for index, items in enumerate(choices))
            )}]}],
            "generationConfig": {
                "maxOutputTokens": 256,
                "responseMimeType": "application/json",
                "responseJsonSchema": {
                    "type": "object",
                    "properties": {"choice": {"type": "integer", "minimum": 0, "maximum": len(choices) - 1}},
                    "required": ["choice"],
                },
            },
        }
        request = Request(
            f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent",
            data=json.dumps(body, ensure_ascii=False).encode(),
            headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
        )
        with urlopen(request, timeout=7) as response:
            candidate = json.load(response)["candidates"][0]
        if candidate.get("finishReason") != "STOP":
            return fallback
        parts = candidate["content"]["parts"]
        choice = json.loads("".join(part.get("text", "") for part in parts if not part.get("thought")))["choice"]
        if type(choice) is int and 0 <= choice < len(choices):
            return {"items": list(choices[choice]), "source": "gemini"}
    except (OSError, ValueError, KeyError, IndexError, TypeError):
        logger.warning("Gemini care advice unavailable; using fallback")
    finally:
        requests.release()

    return fallback
