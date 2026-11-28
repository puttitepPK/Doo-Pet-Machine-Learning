import { apiBase } from '../../../shared/config/api.js';
// ทำงานในเบราว์เซอร์: ส่งรูปไปให้ Backend วิเคราะห์ แล้วรับผลกลับ ไม่ได้โหลด .pth มาใช้บนเว็บ
export async function predict(file, detailed) {
  // ชื่อช่อง image ต้องตรงกับ image: UploadFile ของ /predict ใน main.py
  const fd = new FormData();
  fd.append("image", file);
  let response;
  try {
    // apiBase มาจาก shared/config/api.js; ไม่ส่ง model_type จึงใช้ auto ที่เลือก B3 ก่อน
    // details=true ขอผลหลักพร้อม runs และข้อมูลน้ำหนัก เพื่อใช้บันทึกประวัติ
    response = await fetch(`${apiBase}/predict${detailed ? "?details=true" : ""}`, { method: "POST", body: fd });
  } catch {
    throw new Error("เชื่อมต่อ AI ไม่ได้ กรุณาเปิด API โมเดลก่อนลองอีกครั้ง");
  }
  // Backend ส่งข้อมูล JSON กลับมา; ถ้า CLIP ไม่ให้ผ่าน ข้อความอยู่ใน payload.detail
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.detail || "วิเคราะห์ภาพไม่สำเร็จ กรุณาลองภาพอื่นอีกครั้ง");
  // แบบละเอียดอ่าน predictions; แบบปกติคำตอบเป็นรายการคะแนนโดยตรง
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
  // ปรับชื่อและเรียงคะแนนภายในโมเดลหลัก ไม่ใช่เรียงเพื่อเลือกผู้ชนะระหว่าง 3 โมเดล
  const predictions = scores.map(({ label, score }) => ({ label: labels[label] || label, score: Number(score) }))
    .filter((item) => item.label && Number.isFinite(item.score))
    .sort((a, b) => b.score - a.score);
  return { ...payload, predictions };
}

