const apiBase = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

export const careHeadings = ["สังเกตอาการ", "ดูแลเบื้องต้น", "สิ่งที่ควรหลีกเลี่ยง"];
const defaultCare = [
  "สังเกตว่ามีรอยแดง ขนร่วง หรือเกาและเลียบ่อยขึ้นไหม",
  "ลดการเลียเกาบริเวณที่ระคายเคือง ถ้ารอยลาม เจ็บ หรือมีน้ำซึม ให้พาไปตรวจ",
  "หลีกเลี่ยงการขัดถูหรือใช้ยาทาเอง",
];

export async function loadCareAdvice(disease, signal) {
  const label = disease.trim().toLowerCase().replace(/\s+/g, "_");
  const timeout = AbortSignal.timeout(9500);
  try {
    const response = await fetch(`${apiBase}/care-advice?${new URLSearchParams({ label })}`, {
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data.items) && data.items.length === careHeadings.length &&
          data.items.every(item => typeof item === "string" && item.trim() && item.length <= 500)) {
        return { items: data.items, source: data.source === "gemini" ? "gemini" : "fallback" };
      }
    }
  } catch { /* Fall back when the advice endpoint is unavailable. */ }
  return { items: defaultCare, source: "fallback" };
}
