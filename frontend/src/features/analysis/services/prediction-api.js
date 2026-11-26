import { apiBase } from '../../../shared/config/api.js';
export async function predict(file, detailed) {
  const fd = new FormData();
  fd.append("image", file);
  let response;
  try {
    response = await fetch(`${apiBase}/predict${detailed ? "?details=true" : ""}`, { method: "POST", body: fd });
  } catch {
    throw new Error("เชื่อมต่อ AI ไม่ได้ กรุณาเปิด API โมเดลก่อนลองอีกครั้ง");
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.detail || "วิเคราะห์ภาพไม่สำเร็จ กรุณาลองภาพอื่นอีกครั้ง");
  const scores = detailed ? payload?.predictions : payload;
  if (!Array.isArray(scores)) throw new Error("รูปแบบผลลัพธ์จาก AI ไม่ถูกต้อง");
  const labels = {
    bacterial_dermatosis: "Bacterial Dermatosis",
    demodicosis: "Demodicosis",
    dermatitis: "Dermatitis",
    fungal_infection: "Fungal Infection",
    healthy: "Healthy",
    hypersensitivity: "Hypersensitivity",
  };
  const predictions = scores.map(({ label, score }) => ({ label: labels[label] || label, score: Number(score) }))
    .filter((item) => item.label && Number.isFinite(item.score))
    .sort((a, b) => b.score - a.score);
  return { ...payload, predictions };
}

