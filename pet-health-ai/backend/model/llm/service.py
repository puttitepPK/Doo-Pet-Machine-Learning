"""Coordinate LLM advice independently of FastAPI and image inference."""
from .care_advice import care_advice


def log_advice(label, advice, *, private=False):
    """Print the validated advice shown to the owner, with its actual source."""
    headings = ("สังเกตอาการ", "ดูแลเบื้องต้น", "สิ่งที่ควรหลีกเลี่ยง")
    lines = ["", "=" * 58, f"คำแนะนำการดูแล | ผลคัดกรอง: {label}"]
    source = "Gemini" if advice["source"] == "gemini" else "Fallback (คำแนะนำสำรอง)"
    lines.append(f"แหล่งคำแนะนำหลัก: {source}")
    if private:
        lines.append("  มีข้อมูลเจ้าของ: แสดงข้อความคำแนะนำในหน้าเว็บเท่านั้น")
    else:
        for heading, item in zip(headings, advice["items"]):
            lines.append(f"  {heading}: {item}")
    tips = advice.get("context_tips")
    if tips:
        source = "Gemini" if tips["source"] == "gemini" else "Fallback (คำแนะนำสำรอง)"
        lines.append(f"สิ่งที่ควรสังเกตและจดเพิ่ม | แหล่งที่มา: {source}")
        if not private:
            lines.extend(f"  {index}. {item}" for index, item in enumerate(tips["items"], 1))
    lines.append("=" * 58)
    print("\n".join(lines), flush=True)


def general_advice(label):
    advice = care_advice(label)
    log_advice(label, advice)
    return advice


def advice_with_context(label, score, context, **variation):
    """Context is already normalized by the API boundary; scores stay unchanged."""
    advice = care_advice(label, score=score, context=context, **variation)
    log_advice(label, advice, private=bool(context or variation.get("previous")))
    return {**advice, "owner_context": context, "context_tips": advice.get("context_tips")}
