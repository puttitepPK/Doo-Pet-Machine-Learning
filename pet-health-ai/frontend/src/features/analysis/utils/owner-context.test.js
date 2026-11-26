import assert from "node:assert/strict";
import test from "node:test";
import { emptyOwnerContext, fallbackContextTips, normalizeOwnerContext, ownerContextRows, toggleOption, NOTES_MAX } from "./owner-context.js";

test("nothing answered → null (never 'no symptoms')", () => {
  assert.equal(normalizeOwnerContext(null), null);
  assert.equal(normalizeOwnerContext({ version: 1, ...emptyOwnerContext() }), null);
  assert.equal(normalizeOwnerContext({ version: 1, ...emptyOwnerContext(), notes: "   \n " }), null);
});

test("partial and full answers keep only answered fields in canonical order", () => {
  assert.deepEqual(normalizeOwnerContext({ ...emptyOwnerContext(), duration: "today" }), { version: 1, duration: "today" });
  assert.deepEqual(normalizeOwnerContext({
    version: 1, symptoms: ["redness", "itching"], duration: "2_3_days", body_sites: ["abdomen"], living_environment: "both",
    recent_changes: ["shampoo"], notes: "  เริ่มเกาหลังอาบน้ำ ",
  }), { version: 1, symptoms: ["itching", "redness"], duration: "2_3_days", body_sites: ["abdomen"], living_environment: "both", recent_changes: ["shampoo"], notes: "เริ่มเกาหลังอาบน้ำ" });
});

test("same validation rules as the backend", () => {
  for (const raw of [{ symptoms: ["itching", "unsure"] }, { recent_changes: ["none", "food"] }, { recent_changes: ["none", "unknown"] }, { body_sites: ["multiple", "ears"] },
    { symptoms: "itching" }, { symptoms: ["fever"] }, { duration: "forever" }, { duration: ["today"] }, { notes: 5 }, { notes: "ก".repeat(NOTES_MAX + 1) },
    { version: 2, duration: "today" }, { extra: 1 }, ["itching"]]) {
    assert.throws(() => normalizeOwnerContext(raw), undefined, JSON.stringify(raw));
  }
  assert.equal(normalizeOwnerContext({ notes: "ก".repeat(NOTES_MAX) }).notes.length, NOTES_MAX);
  assert.equal(normalizeOwnerContext({ notes: "a\u202eb\u0000c\r\nd" }).notes, "abc\nd");
});

test("exclusive options replace the others within the same question only", () => {
  assert.deepEqual(toggleOption(["food", "shampoo"], "recent_changes", "none"), ["none"]);
  assert.deepEqual(toggleOption(["none"], "recent_changes", "food"), ["food"]);
  assert.deepEqual(toggleOption(["unknown"], "recent_changes", "none"), ["none"]);
  assert.deepEqual(toggleOption(["itching"], "symptoms", "unsure"), ["unsure"]);
  assert.deepEqual(toggleOption(["redness"], "symptoms", "itching"), ["itching", "redness"]);
  assert.deepEqual(toggleOption(["itching", "redness"], "symptoms", "itching"), ["redness"]);
  assert.deepEqual(toggleOption(["ears"], "body_sites", "multiple"), ["multiple"]);
});

test("display rows show only answered fields and tolerate old/odd stored values", () => {
  assert.deepEqual(ownerContextRows(null), []);
  assert.deepEqual(ownerContextRows({ version: 1, duration: "today", notes: "จด" }).map((row) => [row.title, row.value]), [["ระยะเวลาที่เห็นอาการ", "วันนี้"], ["บันทึกเพิ่มเติม", "จด"]]);
  assert.deepEqual(ownerContextRows({ symptoms: ["itching", "bogus"] }).map((row) => row.value), ["คัน"]);
});

test("fallback tips mirror the backend templates and never echo notes", () => {
  const tips = fallbackContextTips({ version: 1, symptoms: ["itching", "redness"], recent_changes: ["shampoo"], notes: "เกาหลังอาบน้ำ" });
  assert.equal(tips.length, 3);
  assert.match(tips[0], /แชมพู/);
  assert.ok(tips.every((tip) => !tip.includes("อาบน้ำ")));
  assert.deepEqual(fallbackContextTips(null), []);
  assert.equal(fallbackContextTips({ version: 1, duration: "unknown" }).length, 1);
});
