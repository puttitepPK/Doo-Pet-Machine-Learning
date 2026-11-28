import { fallbackContextTips } from "../utils/owner-context.js";

import { apiBase } from '../../../shared/config/api.js';
import { adviceSession } from './advice-session.js';

export const careHeadings = ["สังเกตอาการ", "ดูแลเบื้องต้น", "สิ่งที่ควรหลีกเลี่ยง"];
const defaultCare = [
  "สังเกตว่ามีรอยแดง ขนร่วง หรือเกาและเลียบ่อยขึ้นไหม",
  "ลดการเลียเกาบริเวณที่ระคายเคือง ถ้ารอยลาม เจ็บ หรือมีน้ำซึม ให้พาไปตรวจ",
  "หลีกเลี่ยงการขัดถูแรง บีบตุ่ม หรือแกะสะเก็ด",
];

const validItems = (items) => Array.isArray(items) && items.length === careHeadings.length &&
  items.every((item) => typeof item === "string" && item.trim() && item.length <= 500);
const validTips = (tips) => tips && Array.isArray(tips.items) && tips.items.length >= 1 && tips.items.length <= 3 &&
  tips.items.every((item) => typeof item === "string" && item.trim() && item.length <= 220);

// Both cases use the existing POST endpoint, with optional session-local repetition hints.
export async function loadCareAdvice(disease, signal, { score, ownerContext, adviceScope = 'guest', fetcher = fetch, session = adviceSession } = {}) {
  const label = disease.trim().toLowerCase().replace(/\s+/g, "_");
  const timeout = AbortSignal.timeout(22000);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const ticket = session.begin(adviceScope, label);
  const finish = (advice) => {
    if (!combined.aborted) session.remember(ticket, advice);
    return advice;
  };
  try {
    const response = await fetcher(`${apiBase}/care-advice`, {
      method: "POST", signal: combined, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, score: Number.isFinite(score) ? score : null, owner_context: ownerContext ?? null,
        variation_index: ticket.variation_index, previous_advice: ticket.previous_advice }),
    });
    if (response.ok) {
      const data = await response.json();
      if (validItems(data.items)) {
        const advice = { items: data.items, source: data.source === "gemini" ? "gemini" : "fallback" };
        if (ownerContext) {
          const tips = validTips(data.context_tips) ? data.context_tips : { items: fallbackContextTips(ownerContext), source: "fallback" };
          advice.context_tips = { items: tips.items, source: tips.source === "gemini" ? "gemini" : "fallback" };
        }
        return finish(advice);
      }
    }
  } catch { /* Fall back below. */ }
  return { items: defaultCare, source: "fallback",
    ...(ownerContext ? { context_tips: { items: fallbackContextTips(ownerContext), source: "fallback" } } : {}) };
}
