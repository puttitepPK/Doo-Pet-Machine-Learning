import assert from "node:assert/strict";
import test from "node:test";
import { buildMatches, buildTracking, cardResultOrder, trackingKey, trackingRecords, trackingText, trackingValue, trackingRange, trackingBuckets, trackingDateKey, validTrackingDate, TRACKING_RESULTS } from "./tracking-chart.js";
import { monthRange } from "./health-chart.js";

const pets = [{ id: "a", name: "Buddy" }, { id: "b", name: "Luna" }, { id: "c", name: "Coco" }, { id: "d", name: "Milo" }];
const rows = [
  { id: "before", pet: "a", date: "2026-07-31T16:59:59Z", disease: "healthy" },
  { id: "first", pet: "a", date: "2026-07-31T17:00:00Z", disease: "HEALTHY" },
  { id: "second", pet: "a", date: "2026-08-25T05:00:00Z", disease: "dermatitis" },
  { id: "third", pet: "a", date: "2026-10-31T16:59:59Z", disease: "Dermatitis" },
  { id: "after", pet: "a", date: "2026-10-31T17:00:00Z", disease: "healthy" },
  { id: "b1", pet: "b", date: "2026-08-02T00:00:00+07:00", disease: "healthy" },
  { id: "b2", pet: "b", date: "2026-08-03T00:00:00+07:00", disease: "new_result" },
  { id: "c1", pet: "c", date: "2026-09-03T00:00:00+07:00", disease: "fungal_infection" },
  { id: "bad", pet: "a", date: "bad", disease: "healthy" },
  { id: "null", pet: "a", date: null, disease: "healthy" },
];
const months = monthRange("2026-10", 3);

test("scopes each pet to Bangkok month boundaries and excludes invalid dates", () => {
  const model = buildTracking(rows, pets, ["a", "b"], months);
  assert.deepEqual(months, ["2026-08", "2026-09", "2026-10"]);
  assert.equal(model.rows.length, 5);
  assert.deepEqual(model.series.map(({ total, normal, abnormal }) => ({ total, normal, abnormal })), [{ total: 3, normal: 1, abnormal: 2 }, { total: 2, normal: 1, abnormal: 1 }]);
  assert.equal(model.series[0].monthly[0].total, 2);
  assert.equal(model.series[0].monthly[2].total, 1);
});

test("uses per-pet/range denominators, while monthly percentages use monthly totals", () => {
  const model = buildTracking(rows, pets, ["a", "b"], months);
  const [a, b] = model.series;
  assert.ok(Math.abs(trackingValue(a.counts.healthy, a.total, "share") - 100 / 3) < 1e-10);
  assert.equal(trackingValue(b.counts.healthy, b.total, "share"), 50);
  assert.equal(trackingValue(a.monthly[0].counts.healthy, a.monthly[0].total, "share"), 50);
  assert.equal(trackingValue(a.counts.dermatitis, a.total, "count"), 2);
  assert.equal(trackingText(100 / 3, "share"), "33.3%");
});

test("distinguishes absent month data from a tested month without the category", () => {
  const model = buildTracking(rows, pets, ["a", "d"], months);
  const [a, d] = model.series;
  assert.equal(trackingValue(a.monthly[1].counts.healthy, a.monthly[1].total, "count"), null);
  assert.equal(trackingValue(a.monthly[2].counts.healthy, a.monthly[2].total, "count"), 0);
  assert.equal(trackingValue(0, d.total, "share"), null);
  assert.equal(trackingValue(0, d.total, "count"), null);
  assert.equal(trackingText(null, "share"), "—");
  assert.ok(d.monthly.every((bucket) => bucket.total === 0));
});

test("retains six categories, groups unknown results only when present, and keeps pet colors", () => {
  const a = buildTracking(rows, pets, ["a"], months);
  const b = buildTracking(rows, pets, ["b", "a"], months);
  assert.deepEqual(a.categories, TRACKING_RESULTS);
  assert.equal(b.categories.at(-1), "unknown");
  assert.equal(trackingKey({ disease: "NEW result" }), "unknown");
  assert.equal(trackingKey({ disease: " HEALTHY " }), "healthy");
  assert.equal(a.series[0].color, b.series[1].color);
  assert.notEqual(b.series[0].color, b.series[1].color);
  assert.equal(b.series[0].counts.unknown, 1);
});

test("caps unique selected pets at three and supports 3/6 month ranges", () => {
  const model = buildTracking(rows, pets, ["a", "a", "b", "c", "d"], monthRange("2026-10", 6));
  assert.deepEqual(model.series.map((pet) => pet.id), ["a", "b", "c"]);
  assert.equal(model.series[0].monthly.length, 6);
  assert.equal(model.series[0].total, 4);
  assert.equal(model.series[0].monthly[0].total, 0);
  assert.deepEqual(buildTracking(rows, pets, [], months).rows, []);
});

test("drills into one pet/category/month without mutating or filtering chart totals", () => {
  const model = buildTracking(rows, pets, ["a", "b"], months);
  const result = trackingRecords(model.rows, { pet: "a", result: "dermatitis", month: "2026-10" });
  assert.deepEqual(result.map((row) => row.id), ["third"]);
  assert.deepEqual(trackingRecords(model.rows, { pet: "a", result: "dermatitis" }).map((row) => row.id), ["third", "second"]);
  assert.deepEqual(trackingRecords(model.rows, { pet: "b", result: "unknown" }).map((row) => row.id), ["b2"]);
  assert.equal(trackingRecords(model.rows, null).length, 5);
  assert.equal(model.series[0].total, 3);
});


test("preset ranges end today and start on exact Bangkok calendar boundaries", () => {
  const today = "2026-11-22";
  assert.deepEqual(trackingRange("7d", {}, today), { start: "2026-11-16", end: today, error: "" });
  assert.equal(trackingRange("month", {}, today).start, "2026-11-01");
  assert.equal(trackingRange("3m", {}, today).start, "2026-09-01");
  assert.equal(trackingRange("6m", {}, today).start, "2026-06-01");
  assert.equal(trackingRange("3m", {}, "2026-01-02").start, "2025-11-01");
  assert.equal(trackingBuckets(trackingRange("7d", {}, today), "day").length, 7);
});

test("custom date range validates missing, impossible, reversed, future and >366-day spans", () => {
  const validate = (start, end) => trackingRange("custom", { start, end }, "2026-11-22");
  assert.ok(validate("", "2026-11-22").error);
  assert.ok(validate("2026-02-30", "2026-03-01").error);
  assert.ok(validate("2026-11-22", "2026-11-01").error);
  assert.ok(validate("2026-11-22", "2026-11-23").error);
  assert.ok(validate("2024-01-01", "2026-11-22").error);
  assert.equal(validate("2025-11-22", "2026-11-22").error, "");
  assert.ok(validate("2025-11-21", "2026-11-22").error);
  assert.equal(validate("2026-11-22", "2026-11-22").error, "");
  assert.equal(validTrackingDate("2024-02-29"), true);
  assert.equal(validTrackingDate("2025-02-29"), false);
});

test("day/week/month buckets retain the full range with leap days and clamped edge buckets", () => {
  const daily = trackingBuckets({ start: "2024-02-28", end: "2024-03-01" }, "day");
  assert.deepEqual(daily.map((bucket) => bucket.start), ["2024-02-28", "2024-02-29", "2024-03-01"]);
  const weekly = trackingBuckets({ start: "2026-09-30", end: "2026-10-13" }, "week");
  assert.deepEqual(weekly.map(({ start, end }) => [start, end]), [["2026-09-30", "2026-10-04"], ["2026-10-05", "2026-10-11"], ["2026-10-12", "2026-10-13"]]);
  const sunday = trackingBuckets({ start: "2026-11-01", end: "2026-11-03" }, "week");
  assert.deepEqual(sunday.map(({ start, end }) => [start, end]), [["2026-11-01", "2026-11-01"], ["2026-11-02", "2026-11-03"]]);
  const monthly = trackingBuckets({ start: "2024-01-29", end: "2024-03-02" }, "month");
  assert.deepEqual(monthly.map(({ start, end }) => [start, end]), [["2024-01-29", "2024-01-31"], ["2024-02-01", "2024-02-29"], ["2024-03-01", "2024-03-02"]]);
  assert.deepEqual(trackingBuckets({ start: "2026-01-01", end: "2026-01-02", error: "invalid" }, "day"), []);
});

test("inclusive custom range uses Bangkok midnight and never includes later future rows", () => {
  const saved = [
    { id: "before", pet: "a", date: "2026-10-31T16:59:59.999Z", disease: "healthy" },
    { id: "start", pet: "a", date: "2026-10-31T17:00:00.000Z", disease: "healthy" },
    { id: "end", pet: "a", date: "2026-11-02T16:59:59.999Z", disease: "dermatitis" },
    { id: "after", pet: "a", date: "2026-11-02T17:00:00.000Z", disease: "healthy" },
    { id: "invalid", pet: "a", date: null, disease: "healthy" },
  ];
  const range = trackingRange("custom", { start: "2026-11-01", end: "2026-11-02" }, "2026-11-22");
  const model = buildTracking(saved, pets, ["a"], range, "day");
  assert.deepEqual(model.rows.map((row) => row.id), ["start", "end"]);
  assert.equal(model.series[0].total, 2);
  assert.equal(model.series[0].buckets[0].total, 1);
  assert.equal(model.series[0].buckets[1].counts.dermatitis, 1);
  assert.equal(trackingDateKey("2026-10-31T17:00:00Z"), "2026-11-01");
});

test("aggregation changes only buckets, not totals/cards; shares use each pet per bucket", () => {
  const range = { start: "2026-08-01", end: "2026-10-31" };
  const day = buildTracking(rows, pets, ["a", "b"], range, "day");
  const week = buildTracking(rows, pets, ["a", "b"], range, "week");
  const month = buildTracking(rows, pets, ["a", "b"], range, "month");
  assert.equal(day.buckets.length, 92);
  assert.deepEqual(day.series.map((pet) => pet.total), [3, 2]);
  assert.deepEqual(day.series.map((pet) => pet.counts), week.series.map((pet) => pet.counts));
  assert.deepEqual(day.series.map((pet) => pet.counts), month.series.map((pet) => pet.counts));
  assert.equal(trackingValue(month.series[0].buckets[0].counts.healthy, month.series[0].buckets[0].total, "share"), 50);
  const empty = day.series[0].buckets.find((bucket) => bucket.start === "2026-08-02");
  assert.equal(trackingValue(empty.counts.healthy, empty.total, "share"), null);
  const tested = day.series[0].buckets.find((bucket) => bucket.start === "2026-08-25");
  assert.equal(trackingValue(tested.counts.healthy, tested.total, "share"), 0);
  const bucket = week.series[0].buckets.find((entry) => entry.counts.dermatitis === 1);
  assert.deepEqual(trackingRecords(week.rows, { pet: "a", result: "dermatitis", start: bucket.start, end: bucket.end }).map((row) => row.id), ["second"]);
});

test("matches: same Bangkok day across pets, repeated checks of one pet count as one day", () => {
  const p = [{ id: "a", name: "Buddy" }, { id: "b", name: "Luna" }, { id: "c", name: "Coco" }];
  const r = [
    { id: "a1", pet: "a", date: "2026-08-02T16:30:00Z", disease: "dermatitis" }, // 2 Aug 23:30 BKK
    { id: "b1", pet: "b", date: "2026-08-01T17:30:00Z", disease: "Dermatitis" }, // 2 Aug 00:30 BKK -> same day
    { id: "b2", pet: "b", date: "2026-08-02T17:00:00Z", disease: "dermatitis" }, // 3 Aug 00:00 BKK -> different day
    { id: "a2", pet: "a", date: "2026-08-05T02:00:00Z", disease: "dermatitis" },
    { id: "a3", pet: "a", date: "2026-08-05T09:00:00Z", disease: "dermatitis" }, // repeat of one pet, same day
    { id: "a4", pet: "a", date: "2026-08-05T10:00:00Z", disease: "healthy" },
    { id: "c1", pet: "c", date: "2026-08-03T03:00:00Z", disease: "fungal_infection" },
  ];
  const model = buildTracking(r, p, ["a", "b", "c"], { start: "2026-08-01", end: "2026-08-31", error: "" }, "month");
  const m = buildMatches(model.rows, model.series);
  assert.equal(m.petTotal, 3);
  assert.deepEqual(m.shared.map((c) => c.key), ["dermatitis"]);
  const derm = m.shared[0];
  assert.deepEqual(derm.pets.map((pet) => pet.count), [3, 2, 0]);
  assert.equal(derm.petCount, 2);
  assert.equal(derm.sameDays, 1);
  assert.equal(derm.allSameDays, 0);
  assert.deepEqual(derm.days.map((d) => d.day), ["2026-08-05", "2026-08-03", "2026-08-02"]);
  const aug5 = derm.days[0];
  assert.deepEqual(aug5.pets.map(({ count, checked }) => ({ count, checked })), [{ count: 2, checked: 3 }, { count: 0, checked: 0 }, { count: 0, checked: 0 }]);
  const aug3 = derm.days[1];
  assert.deepEqual(aug3.pets.map(({ count, checked }) => ({ count, checked })), [{ count: 0, checked: 0 }, { count: 1, checked: 1 }, { count: 0, checked: 1 }]);
  assert.equal(m.categories.find((c) => c.key === "fungal_infection").shared, false);
});

test("matches: all three pets on one day are counted once, with partial matches kept separate", () => {
  const p = [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }];
  const r = [
    { id: 1, pet: "a", date: "2026-09-10T01:00:00Z", disease: "healthy" },
    { id: 2, pet: "b", date: "2026-09-10T05:00:00Z", disease: "healthy" },
    { id: 3, pet: "c", date: "2026-09-10T08:00:00Z", disease: "healthy" },
    { id: 4, pet: "a", date: "2026-09-11T01:00:00Z", disease: "healthy" },
    { id: 5, pet: "b", date: "2026-09-11T02:00:00Z", disease: "healthy" },
  ];
  const model = buildTracking(r, p, ["a", "b", "c"], { start: "2026-09-01", end: "2026-09-30", error: "" }, "month");
  const healthy = buildMatches(model.rows, model.series).shared[0];
  assert.equal(healthy.sameDays, 2);
  assert.equal(healthy.allSameDays, 1);
  assert.equal(healthy.petCount, 3);
});

test("card order: shared results first by combined count, same order for every card, single-pet results below", () => {
  const p = [{ id: "a", name: "บุ๊ดดู้" }, { id: "b", name: "เส้นเล็ก" }, { id: "c", name: "Coco" }];
  const at = (day) => `2026-09-${day}T10:00:00+07:00`;
  const r = [
    ...["01", "02", "03"].map((d, i) => ({ id: `h${i}`, pet: "a", date: at(d), disease: "healthy" })),
    { id: "d1", pet: "a", date: at("04"), disease: "dermatitis" }, { id: "d2", pet: "a", date: at("05"), disease: "dermatitis" },
    { id: "d3", pet: "b", date: at("04"), disease: "dermatitis" },
    { id: "x1", pet: "a", date: at("06"), disease: "bacterial_dermatosis" },
    { id: "x2", pet: "b", date: at("06"), disease: "bacterial_dermatosis" }, { id: "x3", pet: "b", date: at("07"), disease: "bacterial_dermatosis" },
    { id: "f1", pet: "b", date: at("08"), disease: "fungal_infection" },
  ];
  const range = { start: "2026-09-01", end: "2026-09-30", error: "" };
  const two = buildTracking(r, p, ["a", "b"], range, "month");
  const order = cardResultOrder(two.series, two.categories);
  // dermatitis 3 and bacterial 3 tie on total and pet count -> by Thai name; healthy (3, one pet) after them.
  assert.deepEqual(order.map((o) => [o.key, o.total, o.shared]), [["dermatitis", 3, true], ["bacterial_dermatosis", 3, true], ["healthy", 3, false], ["fungal_infection", 1, false]]);
  assert.ok(!order.some((o) => o.total === 0));
  // Order follows the selected pets: with บุ๊ดดู้ alone nothing is shared and his own counts decide.
  const one = buildTracking(r, p, ["a"], range, "month");
  assert.deepEqual(cardResultOrder(one.series, one.categories).map((o) => [o.key, o.shared]), [["healthy", false], ["dermatitis", false], ["bacterial_dermatosis", false]]);
  // Ties on total are broken by how many pets share the result.
  const three = buildTracking([...r, { id: "c1", pet: "c", date: at("09"), disease: "fungal_infection" }, { id: "c2", pet: "c", date: at("10"), disease: "healthy" }], p, ["a", "b", "c"], range, "month");
  const o3 = cardResultOrder(three.series, three.categories);
  assert.deepEqual(o3.map((o) => [o.key, o.total, o.petCount]), [["healthy", 4, 2], ["dermatitis", 3, 2], ["bacterial_dermatosis", 3, 2], ["fungal_infection", 2, 2]]);
});
