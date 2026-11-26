import { fallbackContextTips } from "../utils/owner-context.js";

import { apiBase } from '../../../shared/config/api.js';

export const careHeadings = ["สังเกตอาการ", "ดูแลเบื้องต้น", "สิ่งที่ควรหลีกเลี่ยง"];
const defaultCare = [
  "สังเกตว่ามีรอยแดง ขนร่วง หรือเกาและเลียบ่อยขึ้นไหม",
  "ลดการเลียเกาบริเวณที่ระคายเคือง ถ้ารอยลาม เจ็บ หรือมีน้ำซึม ให้พาไปตรวจ",
  "หลีกเลี่ยงการขัดถูหรือใช้ยาทาเอง",
];

const validItems = (items) => Array.isArray(items) && items.length === careHeadings.length &&
  items.every((item) => typeof item === "string" && item.trim() && item.length <= 500);
const validTips = (tips) => tips && Array.isArray(tips.items) && tips.items.length >= 1 && tips.items.length <= 3 &&
  tips.items.every((item) => typeof item === "string" && item.trim() && item.length <= 220);

// General advice (unchanged behaviour). With owner context, the API also returns extra observation tips;
// any failure falls back to fixed advice so the check result is never lost.
export async function loadCareAdvice(disease, signal, { score, ownerContext, fetcher = fetch } = {}) {
  const label = disease.trim().toLowerCase().replace(/\s+/g, "_");
  const timeout = AbortSignal.timeout(ownerContext ? 12000 : 9500);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  if (ownerContext) {
    try {
      const response = await fetcher(`${apiBase}/care-advice`, {
        method: "POST", signal: combined, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, score: Number.isFinite(score) ? score : null, owner_context: ownerContext }),
      });
      if (response.ok) {
        const data = await response.json();
        if (validItems(data.items)) {
          const tips = validTips(data.context_tips) ? data.context_tips : { items: fallbackContextTips(ownerContext), source: "fallback" };
          return { items: data.items, source: data.source === "gemini" ? "gemini" : "fallback", context_tips: { items: tips.items, source: tips.source === "gemini" ? "gemini" : "fallback" } };
        }
      }
    } catch { /* Fall back below. */ }
    const general = await loadCareAdvice(disease, signal, { fetcher });
    return { ...general, context_tips: { items: fallbackContextTips(ownerContext), source: "fallback" } };
  }
  try {
    const response = await fetcher(`${apiBase}/care-advice?${new URLSearchParams({ label })}`, { signal: combined });
    if (response.ok) {
      const data = await response.json();
      if (validItems(data.items)) return { items: data.items, source: data.source === "gemini" ? "gemini" : "fallback" };
    }
  } catch { /* Fall back when the advice endpoint is unavailable. */ }
  return { items: defaultCare, source: "fallback" };
}
