// Pure helpers for the History page chart (monthly overview + per-month detail).
// Every count comes from the signed-in user's saved history rows (doo_pet_history).
// Month boundaries are always computed in Asia/Bangkok so the chart, summary and list agree.
import { diseaseName } from "./disease-labels.js";

export const CHART_RANGES = [3, 6];
const TZ = "Asia/Bangkok";
const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const THAI_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const pad = (value) => String(value).padStart(2, "0");
const dayFormat = new Intl.DateTimeFormat("en-US", { timeZone: TZ, day: "numeric" });
const keyFormat = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "numeric" });

// "YYYY-MM" (Gregorian) of an instant, as seen in Bangkok.
export function bangkokMonthKey(date) {
  const parts = Object.fromEntries(keyFormat.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${pad(parts.month)}`;
}
export const currentMonthKey = (now = new Date()) => bangkokMonthKey(now);
export function recordMonthKey(record) {
  if (!record?.date) return null;
  const date = new Date(record?.date);
  return Number.isNaN(date.getTime()) ? null : bangkokMonthKey(date);
}

const splitKey = (key) => key.split("-").map(Number);
export function shiftMonth(key, delta) {
  const [year, month] = splitKey(key);
  const index = year * 12 + (month - 1) + delta;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
}
// Oldest → newest, `count` months ending at `endKey`.
export const monthRange = (endKey, count) => Array.from({ length: count }, (_, index) => shiftMonth(endKey, index - count + 1));
export function monthsBetween(fromKey, toKey) {
  const keys = [];
  for (let key = fromKey; key <= toKey; key = shiftMonth(key, 1)) keys.push(key);
  return keys;
}

export const monthLong = (key) => { const [year, month] = splitKey(key); return `${THAI_MONTHS[month - 1]} ${year + 543}`; };
export const monthShort = (key) => THAI_MONTHS_SHORT[splitKey(key)[1] - 1];
export const monthYearShort = (key) => String(splitKey(key)[0] + 543).slice(-2);

export const diseaseKey = (record) => String(record?.disease ?? "").trim().toLowerCase().replace(/\s+/g, "_") || "unknown";
export const isNormal = (record) => diseaseKey(record) === "healthy";

export function buildMonthlyCounts(records, keys) {
  const counts = new Map(keys.map((key) => [key, 0]));
  for (const record of records) {
    const key = recordMonthKey(record);
    if (counts.has(key)) counts.set(key, counts.get(key) + 1);
  }
  return keys.map((key) => ({ key, total: counts.get(key) }));
}

// Category colours: fixed per result type so they stay consistent; normal is green.
// Hues are categorical only — no reds/ambers that could read as "more severe".
const DISEASE_COLORS = {
  healthy: "#2fa66a",
  dermatitis: "#3f86d4",
  fungal_infection: "#b0894a",
  bacterial_dermatosis: "#8b6fd0",
  demodicosis: "#2a9fb3",
  hypersensitivity: "#c46aa6",
  skin_infection: "#5a6fc0",
  ear_infection: "#6f8a9e",
  eye_irritation: "#8a9a3e",
};
const FALLBACK_COLORS = ["#5b7fa6", "#9a7bb8", "#4f9a94", "#a98564", "#7d86b8", "#b07a9a"];
export function diseaseColor(key) {
  if (DISEASE_COLORS[key]) return DISEASE_COLORS[key];
  const hash = [...key].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

// Only result types that actually occur in `records`; most frequent first.
export function buildDiseaseBreakdown(records) {
  const groups = new Map();
  for (const record of records) {
    const key = diseaseKey(record);
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  const total = records.length;
  return [...groups].map(([key, count]) => ({
    key, count, share: total ? count / total : 0,
    label: key === "unknown" ? "ไม่ระบุผลวิเคราะห์" : diseaseName(key),
    color: diseaseColor(key), normal: key === "healthy",
  })).sort((a, b) => b.count - a.count || Number(b.normal) - Number(a.normal) || a.label.localeCompare(b.label, "th"));
}

export const formatShare = (share) => `${Math.round(share * 100)}%`;

// Whole-number axis with about four steps.
export function integerTicks(max) {
  if (max <= 0) return [0, 1];
  const rough = max / 4;
  const step = rough <= 1 ? 1 : rough <= 2 ? 2 : rough <= 5 ? 5 : Math.ceil(rough / 5) * 5;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: top / step + 1 }, (_, index) => index * step);
}

// Every calendar day is retained, including days without examinations.
export function buildDailyCounts(records, month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month ?? "")) return [];
  const [year, monthNumber] = splitKey(month);
  const end = new Date(0);
  end.setUTCFullYear(year, monthNumber, 0);
  const days = Array.from({ length: end.getUTCDate() }, (_, index) => ({
    key: `${month}-${pad(index + 1)}`, day: index + 1, records: [],
  }));
  for (const record of records) {
    if (recordMonthKey(record) !== month) continue;
    const day = Number(dayFormat.format(new Date(record.date)));
    days[day - 1].records.push(record);
  }
  return days.map(({ key, day, records: rows }) => ({
    key, day, total: rows.length, breakdown: buildDiseaseBreakdown(rows),
  }));
}
