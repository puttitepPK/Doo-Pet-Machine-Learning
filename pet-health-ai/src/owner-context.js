// "ข้อมูลประกอบการตรวจ (ไม่บังคับ)" — stable codes + Thai labels, mirrored in model/owner_context.py.
// This data only shapes the care-advice text. It is never sent to /predict and never changes model scores.

export const OWNER_CONTEXT_VERSION = 1;
export const NOTES_MAX = 500;

export const OWNER_FIELDS = [
  { key: "symptoms", title: "อาการที่เจ้าของสังเกต", hint: "เลือกได้หลายข้อ", multi: true, exclusive: ["unsure"],
    options: [["itching", "คัน"], ["licking_scratching", "เลียหรือเกาบ่อย"], ["hair_loss", "ขนร่วง"], ["redness", "ผิวแดง"], ["unsure", "ไม่แน่ใจ"]] },
  { key: "duration", title: "ระยะเวลาที่เห็นอาการ", multi: false,
    options: [["today", "วันนี้"], ["2_3_days", "2–3 วัน"], ["about_1_week", "ประมาณหนึ่งสัปดาห์"], ["longer", "นานกว่านั้น"], ["unknown", "ไม่ทราบ"]] },
  { key: "body_sites", title: "บริเวณที่พบ", hint: "เลือกได้หลายข้อ", multi: true, exclusive: ["multiple"],
    options: [["face", "หน้า"], ["ears", "หู"], ["body", "ลำตัว"], ["abdomen", "ท้อง"], ["legs_paws", "ขาและอุ้งเท้า"], ["multiple", "หลายจุด"]] },
  { key: "living_environment", title: "สถานที่เลี้ยง", multi: false,
    options: [["indoor", "ในบ้าน"], ["outdoor", "นอกบ้าน"], ["both", "ทั้งสองแบบ"], ["unknown", "ไม่ทราบ"]] },
  { key: "recent_changes", title: "สิ่งที่เปลี่ยนช่วงนี้", hint: "เลือกได้หลายข้อ", multi: true, exclusive: ["none", "unknown"],
    options: [["food", "อาหาร"], ["shampoo", "แชมพู"], ["bedding", "ที่นอน"], ["play_area", "สถานที่ไปเล่น"], ["none", "ไม่มี"], ["unknown", "ไม่ทราบ"]] },
];
const FIELD = Object.fromEntries(OWNER_FIELDS.map((field) => [field.key, field]));
const ALLOWED_KEYS = new Set(["version", "notes", ...OWNER_FIELDS.map((field) => field.key)]);
// Bidi overrides / zero-width / control characters are removed from notes.
// eslint-disable-next-line no-control-regex -- removing control characters is the purpose of this pattern
const CONTROL = new RegExp("[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\\u200b-\\u200f\\u202a-\\u202e\\u2066-\\u2069]", "g");

export const emptyOwnerContext = () => ({ symptoms: [], duration: null, body_sites: [], living_environment: null, recent_changes: [], notes: "" });

export const optionLabel = (key, code) => FIELD[key]?.options.find(([value]) => value === code)?.[1] ?? code;

// Toggle one checkbox while keeping "ไม่มี / ไม่ทราบ / ไม่แน่ใจ / หลายจุด" exclusive within the same question.
export function toggleOption(current, key, code) {
  const field = FIELD[key];
  const chosen = current.includes(code) ? current.filter((value) => value !== code) : [...current, code];
  if (!chosen.includes(code)) return chosen;
  if (field.exclusive?.includes(code)) return [code];
  const kept = chosen.filter((value) => !field.exclusive?.includes(value));
  return field.options.map(([value]) => value).filter((value) => kept.includes(value));
}

export const cleanNotes = (value) => String(value ?? "").normalize("NFC").replace(CONTROL, "").replace(/\r\n?/g, "\n").trim();

// Canonical payload, or null when nothing was answered. Unanswered fields are omitted, never read as "no symptoms".
export function normalizeOwnerContext(raw) {
  if (raw == null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) throw new Error("รูปแบบข้อมูลประกอบไม่ถูกต้อง");
  if (Object.keys(raw).some((key) => !ALLOWED_KEYS.has(key))) throw new Error("มีช่องข้อมูลที่ระบบไม่รู้จัก");
  if (raw.version !== undefined && raw.version !== OWNER_CONTEXT_VERSION) throw new Error("เวอร์ชันข้อมูลประกอบไม่รองรับ");
  const result = {};
  for (const field of OWNER_FIELDS) {
    const value = raw[field.key];
    if (value == null) continue;
    const allowed = field.options.map(([code]) => code);
    if (field.multi) {
      if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !allowed.includes(item))) throw new Error("มีค่าที่ไม่อยู่ในตัวเลือก");
      const chosen = new Set(value);
      if (!chosen.size) continue;
      if ([...chosen].some((item) => field.exclusive?.includes(item)) && chosen.size > 1) throw new Error("ตัวเลือก “ไม่มี / ไม่ทราบ / ไม่แน่ใจ / หลายจุด” เลือกร่วมกับข้ออื่นไม่ได้");
      result[field.key] = allowed.filter((code) => chosen.has(code));
    } else {
      if (typeof value !== "string" || !allowed.includes(value)) throw new Error("มีค่าที่ไม่อยู่ในตัวเลือก");
      result[field.key] = value;
    }
  }
  if (raw.notes != null) {
    if (typeof raw.notes !== "string") throw new Error("บันทึกเพิ่มเติมต้องเป็นข้อความ");
    const notes = cleanNotes(raw.notes);
    if (notes.length > NOTES_MAX) throw new Error(`บันทึกเพิ่มเติมยาวได้ไม่เกิน ${NOTES_MAX} ตัวอักษร`);
    if (notes) result.notes = notes;
  }
  return Object.keys(result).length ? { version: OWNER_CONTEXT_VERSION, ...result } : null;
}

// Rows for display: only answered fields, in form order. Stored data from older rows is validated leniently.
export function ownerContextRows(context) {
  if (!context || typeof context !== "object") return [];
  const rows = [];
  for (const field of OWNER_FIELDS) {
    const value = context[field.key];
    const codes = (Array.isArray(value) ? value : value ? [value] : []).filter((code) => field.options.some(([option]) => option === code));
    if (codes.length) rows.push({ key: field.key, title: field.title, value: codes.map((code) => optionLabel(field.key, code)).join(", ") });
  }
  if (typeof context.notes === "string" && context.notes.trim()) rows.push({ key: "notes", title: "บันทึกเพิ่มเติม", value: context.notes.trim() });
  return rows;
}

// Same fixed templates as model/care_context.py fallback_tips — used when the advice API is unreachable.
export function fallbackContextTips(context) {
  if (!context) return [];
  const tips = [];
  const changes = (context.recent_changes ?? []).filter((code) => code !== "none" && code !== "unknown");
  if (changes.length) tips.push(`จดวันที่เปลี่ยน${changes.map((code) => optionLabel("recent_changes", code)).join(" ")} และอาการก่อน–หลังเปลี่ยน ไว้เล่าให้สัตวแพทย์ฟัง ข้อมูลนี้ยังสรุปไม่ได้ว่าเป็นสาเหตุ`);
  const symptoms = (context.symptoms ?? []).filter((code) => code !== "unsure");
  if (symptoms.includes("itching") || symptoms.includes("licking_scratching")) tips.push("จดว่าน้องคัน เลีย หรือเกาบ่อยแค่ไหนในแต่ละวัน และมักเป็นช่วงเวลาไหน");
  if (symptoms.includes("hair_loss")) tips.push("สังเกตว่าบริเวณที่ขนร่วงขยายกว้างขึ้นหรือมีจุดใหม่เพิ่มหรือไม่");
  if (symptoms.includes("redness")) tips.push("สังเกตว่ารอยแดงลาม มีน้ำซึม หรือมีกลิ่นผิดปกติเพิ่มขึ้นหรือไม่");
  const sites = (context.body_sites ?? []).filter((code) => code !== "multiple");
  if (sites.length) tips.push(`ติดตามบริเวณ${sites.map((code) => optionLabel("body_sites", code)).join(" ")}เป็นหลัก และดูว่ามีจุดใหม่ที่อื่นหรือไม่`);
  else if ((context.body_sites ?? []).includes("multiple")) tips.push("จดว่าพบอาการที่จุดไหนบ้าง และมีจุดใหม่เพิ่มขึ้นหรือไม่");
  if (context.duration && context.duration !== "unknown") tips.push(`อาการเริ่มมา${optionLabel("duration", context.duration)} ลองจดว่าแต่ละวันอาการดีขึ้น คงที่ หรือแย่ลง`);
  if (["outdoor", "both"].includes(context.living_environment)) tips.push("หลังกลับจากนอกบ้าน สังเกตว่าอาการคันหรือรอยแดงเปลี่ยนไปหรือไม่ และจดสถานที่ที่ไป");
  if (!tips.length) tips.push("จดอาการที่เห็นในแต่ละวันสั้น ๆ เพื่อใช้เล่าให้สัตวแพทย์ฟังหากอาการไม่ดีขึ้น");
  return tips.slice(0, 3);
}
