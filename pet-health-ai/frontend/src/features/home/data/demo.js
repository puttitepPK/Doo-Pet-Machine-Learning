import { DEFAULT_PETS } from "../../pets/constants/default-pets.js";
export const PETS = DEFAULT_PETS;
export const HISTORY = [
  { id: 1, pet: 1, date: "2025-09-20T14:32", disease: "Skin Infection", risk: "mid" },
  { id: 2, pet: 2, date: "2025-09-15T10:21", disease: "Ear Infection", risk: "low" },
  { id: 3, pet: 3, date: "2025-09-05T16:45", disease: "Eye Irritation", risk: "high" },
  { id: 4, pet: 4, date: "2025-08-28T11:12", disease: "Healthy", risk: "low" },
];
export const CLINICS = [
  { name: "Pet Care Animal Hospital", km: 0.8, rate: 4.8, n: 124, hours: "08:00 – 22:00", tel: "02-123-4567", x: 30, y: 28 },
  { name: "โรงพยาบาลสัตว์บางนอกเพ็ท", km: 1.2, rate: 4.6, n: 96, hours: "09:00 – 20:00", tel: "02-345-6789", x: 64, y: 44 },
  { name: "คลินิกรักษาสัตว์หมอโย", km: 1.8, rate: 4.5, n: 74, hours: "09:00 – 19:00", tel: "02-987-6543", x: 42, y: 68 },
];
export const ADVICE = {
  "Skin Infection": [
    "แยกน้องออกจากสัตว์เลี้ยงตัวอื่นชั่วคราว เพื่อลดการแพร่เชื้อ",
    "อย่าทายาหรือใช้แชมพูยาเองก่อนปรึกษาสัตวแพทย์",
    "ซักและตากผ้าปูที่นอนให้แห้งสนิท",
    "ถ้ารอยโรคลามหรือน้องเกาไม่หยุด ควรพบสัตวแพทย์ภายใน 1–2 วัน",
  ],
  default: ["สังเกตอาการต่อเนื่อง 2–3 วัน", "ถ่ายรูปบริเวณที่สงสัยไว้เทียบ", "หากอาการแย่ลง ให้พบสัตวแพทย์"],
};

