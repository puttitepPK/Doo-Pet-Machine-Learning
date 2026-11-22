import { diseaseKey, monthLong, recordMonthKey } from "./health-chart.js";
import { diseaseName } from "./disease-labels.js";

export const TRACKING_RESULTS = ["healthy", "dermatitis", "fungal_infection", "bacterial_dermatosis", "demodicosis", "hypersensitivity"];
export const trackingKey = (record) => TRACKING_RESULTS.includes(diseaseKey(record)) ? diseaseKey(record) : "unknown";
export const trackingLabel = (key) => key === "unknown" ? "ผลอื่น ๆ / ไม่ระบุ" : diseaseName(key);
export const trackingValue = (count, total, unit) => total === 0 ? null : unit === "share" ? count / total * 100 : count;
export const trackingText = (value, unit) => value === null ? "—" : unit === "share" ? `${Math.round(value * 10) / 10}%` : `${value} ครั้ง`;
export const MAX_TRACKING_DAYS = 366;
const DAY = 86400000;
const dateParts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" });
const thaiDate = new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });
const shortDate = new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", day: "numeric", month: "short", year: "2-digit" });
const epoch = (key) => Date.parse(`${key}T00:00:00.000Z`);
export const validTrackingDate = (key) => /^\d{4}-\d{2}-\d{2}$/.test(key ?? "") && Number.isFinite(epoch(key)) && new Date(epoch(key)).toISOString().slice(0, 10) === key;
export const addTrackingDays = (key, count) => new Date(epoch(key) + count * DAY).toISOString().slice(0, 10);
export function trackingDateKey(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = Object.fromEntries(dateParts.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export const trackingDateLabel = (key, short = false) => validTrackingDate(key) ? (short ? shortDate : thaiDate).format(new Date(epoch(key))) : "—";
export const trackingRangeLabel = (range) => range.start && range.end ? range.start === range.end ? trackingDateLabel(range.start) : `${trackingDateLabel(range.start)} – ${trackingDateLabel(range.end)}` : "ยังไม่ได้เลือกช่วงวันที่";

// Date-only keys avoid the execution host's timezone. Both endpoints are inclusive in Bangkok.
export function trackingRange(preset, custom = {}, today = trackingDateKey(new Date())) {
  let start;
  let end = today;
  if (preset === "custom") { start = custom.start; end = custom.end; }
  else if (preset === "7d") start = addTrackingDays(today, -6);
  else if (preset === "month") start = `${today.slice(0, 7)}-01`;
  else {
    const count = preset === "3m" ? 3 : 6;
    const date = new Date(epoch(`${today.slice(0, 7)}-01`));
    date.setUTCMonth(date.getUTCMonth() - count + 1);
    start = date.toISOString().slice(0, 10);
  }
  const error = !validTrackingDate(start) || !validTrackingDate(end) ? "กรุณาเลือกวันที่เริ่มต้นและสิ้นสุดให้ครบและถูกต้อง" : start > end ? "วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด" : end > today ? "ไม่สามารถเลือกวันที่ในอนาคตได้" : (epoch(end) - epoch(start)) / DAY + 1 > MAX_TRACKING_DAYS ? `เลือกช่วงได้ไม่เกิน ${MAX_TRACKING_DAYS} วัน กรุณาลดช่วงวันที่` : "";
  return { start: start ?? "", end: end ?? "", error };
}

export function trackingBuckets(range, group = "month") {
  if (!validTrackingDate(range?.start) || !validTrackingDate(range?.end) || range.start > range.end || range.error || (epoch(range.end) - epoch(range.start)) / DAY + 1 > MAX_TRACKING_DAYS) return [];
  const buckets = [];
  for (let cursor = range.start; cursor <= range.end;) {
    const date = new Date(epoch(cursor));
    let end = cursor;
    if (group === "week") end = addTrackingDays(cursor, 6 - (date.getUTCDay() + 6) % 7);
    else if (group === "month") {
      date.setUTCMonth(date.getUTCMonth() + 1, 0);
      end = date.toISOString().slice(0, 10);
    }
    end = end > range.end ? range.end : end;
    buckets.push({ key: `${cursor}/${end}`, start: cursor, end, label: group === "month" ? monthLong(cursor.slice(0, 7)) : cursor === end ? trackingDateLabel(cursor, true) : `${trackingDateLabel(cursor, true)} – ${trackingDateLabel(end, true)}` });
    cursor = addTrackingDays(end, 1);
  }
  return buckets;
}

// Supports the original month-array API as well as an inclusive date range plus aggregation.
// Each denominator belongs to one pet and one bucket; unexamined buckets remain null in the UI.
export function buildTracking(records, pets, selectedIds, period, group = "month") {
  const legacy = Array.isArray(period);
  const months = legacy ? period : [];
  const allowed = new Set(months);
  const buckets = legacy ? months.map((month) => ({ key: month, month, label: monthLong(month) })) : trackingBuckets(period, group);
  const ids = [...new Set(selectedIds)].slice(0, 3);
  const selected = new Set(ids);
  const rows = records.filter((record) => {
    if (!selected.has(record.pet)) return false;
    if (legacy) return allowed.has(recordMonthKey(record));
    const day = trackingDateKey(record.date);
    return buckets.length > 0 && day && day >= period.start && day <= period.end;
  });
  const categories = [...TRACKING_RESULTS, ...(rows.some((record) => trackingKey(record) === "unknown") ? ["unknown"] : [])];
  const allIds = [...new Set(pets.map((pet) => pet.id))].sort();
  const countsFor = (source) => Object.fromEntries(categories.map((key) => [key, source.filter((record) => trackingKey(record) === key).length]));
  const series = ids.map((id) => {
    const animal = pets.find((pet) => pet.id === id);
    const petRows = rows.filter((record) => record.pet === id);
    const normal = petRows.filter((record) => trackingKey(record) === "healthy").length;
    const hue = (28 + Math.max(0, allIds.indexOf(id)) * 137.508) % 360;
    const data = buckets.map((bucket) => {
      const bucketRows = petRows.filter((record) => legacy ? recordMonthKey(record) === bucket.month : trackingDateKey(record.date) >= bucket.start && trackingDateKey(record.date) <= bucket.end);
      return { ...bucket, total: bucketRows.length, counts: countsFor(bucketRows) };
    });
    return { id, name: animal?.name ?? "ไม่พบข้อมูลสัตว์เลี้ยง", color: `hsl(${hue} 52% 38%)`, total: petRows.length, normal, abnormal: petRows.length - normal, counts: countsFor(petRows), buckets: data, monthly: data };
  });
  return { rows, series, categories, buckets };
}

export function trackingRecords(rows, drill) {
  return rows.filter((record) => !drill || record.pet === drill.pet && trackingKey(record) === drill.result && (!drill.month || recordMonthKey(record) === drill.month) && (!drill.start || trackingDateKey(record.date) >= drill.start && trackingDateKey(record.date) <= drill.end))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

// "ผลตรวจที่ตรงกัน": result types seen in two or more of the selected pets within the range.
// Days are Bangkok calendar dates; a day matches when at least two different pets have that result type
// on that date, so repeated checks of one pet never add extra matching days.
export function buildMatches(rows, series) {
  const ids = series.map((pet) => pet.id);
  const selected = new Set(ids);
  const checked = new Map(ids.map((id) => [id, new Map()]));
  const groups = new Map();
  for (const record of rows) {
    if (!selected.has(record.pet)) continue;
    const day = trackingDateKey(record.date);
    if (!day) continue;
    const petDays = checked.get(record.pet);
    petDays.set(day, (petDays.get(day) ?? 0) + 1);
    const key = trackingKey(record);
    if (!groups.has(key)) groups.set(key, new Map());
    const days = groups.get(key);
    if (!days.has(day)) days.set(day, new Map());
    const pets = days.get(day);
    if (!pets.has(record.pet)) pets.set(record.pet, []);
    pets.get(record.pet).push(record);
  }
  const categories = [...groups].map(([key, dayMap]) => {
    const days = [...dayMap].map(([day, petMap]) => {
      const pets = series.map((pet) => {
        const records = (petMap.get(pet.id) ?? []).slice().sort((a, b) => new Date(b.date) - new Date(a.date));
        return { id: pet.id, name: pet.name, color: pet.color, count: records.length, checked: checked.get(pet.id).get(day) ?? 0, records };
      });
      return { day, pets, matched: pets.filter((pet) => pet.count > 0).length };
    }).sort((a, b) => (a.day < b.day ? 1 : -1));
    const pets = series.map((pet) => ({ id: pet.id, name: pet.name, color: pet.color, count: days.reduce((sum, day) => sum + day.pets.find((entry) => entry.id === pet.id).count, 0), checked: pet.total ?? 0 }));
    const petCount = pets.filter((pet) => pet.count > 0).length;
    return {
      key, label: trackingLabel(key), pets, petCount, total: pets.reduce((sum, pet) => sum + pet.count, 0), days,
      shared: petCount >= 2,
      sameDays: days.filter((day) => day.matched >= 2).length,
      allSameDays: ids.length >= 3 ? days.filter((day) => day.matched === ids.length).length : 0,
    };
  }).sort((a, b) => Number(b.shared) - Number(a.shared) || b.petCount - a.petCount || b.sameDays - a.sameDays || b.total - a.total || a.label.localeCompare(b.label, "th"));
  return { categories, shared: categories.filter((category) => category.shared), petTotal: ids.length };
}

// One shared result order for every pet card, recomputed from the selected pets and range (counts are never changed).
// Types seen in 2+ pets come first, by combined count, then number of pets, then name;
// types seen in only one pet follow, by count then name. Zero-count types are dropped.
export function cardResultOrder(series, categories) {
  const byName = (a, b) => a.label.localeCompare(b.label, "th");
  const info = categories.map((key) => {
    const counts = series.map((pet) => pet.counts?.[key] ?? 0);
    return { key, label: trackingLabel(key), total: counts.reduce((sum, count) => sum + count, 0), petCount: counts.filter((count) => count > 0).length };
  }).filter((item) => item.total > 0);
  const shared = info.filter((item) => item.petCount >= 2).sort((a, b) => b.total - a.total || b.petCount - a.petCount || byName(a, b));
  const single = info.filter((item) => item.petCount === 1).sort((a, b) => b.total - a.total || byName(a, b));
  return [...shared.map((item) => ({ ...item, shared: true })), ...single.map((item) => ({ ...item, shared: false }))];
}
