import { useId, useState } from "react";
import { ChevronDown, ClipboardPen, Info, RotateCcw } from "lucide-react";
import { NOTES_MAX, OWNER_FIELDS, emptyOwnerContext, ownerContextRows, toggleOption } from "../utils/owner-context.js";
import "../styles/OwnerContext.css";

// Optional, collapsible questions under the upload box. Skipping everything keeps the normal image check.
export default function OwnerContextForm({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const answered = ownerContextRows(value).length;
  const set = (key, next) => onChange({ ...value, [key]: next });

  return (
    <section className={`owner-context${open ? " open" : ""}`}>
      <button type="button" className="owner-context-toggle" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((current) => !current)}>
        <span className="owner-context-icon" aria-hidden="true"><ClipboardPen size={18} /></span>
        <span className="owner-context-title"><b>เพิ่มข้อมูลประกอบการตรวจ</b><small>ไม่บังคับ · ข้ามได้</small></span>
        {answered > 0 && <span className="owner-context-count">ตอบแล้ว {answered} ข้อ</span>}
        <ChevronDown className="owner-context-chevron" size={18} aria-hidden="true" />
      </button>
      <div id={panelId} className="owner-context-panel" hidden={!open}>
        <p className="owner-context-note"><Info size={15} aria-hidden="true" />ข้อมูลนี้ใช้ปรับคำแนะนำการสังเกตอาการเท่านั้น ไม่เปลี่ยนผลวิเคราะห์หรือคะแนนจากภาพ ข้อที่ไม่ตอบจะถือว่า “ไม่ได้ระบุ”</p>
        <fieldset disabled={disabled} className="owner-context-fields">
          {OWNER_FIELDS.map((field) => {
            const current = value[field.key];
            return (
              <div key={field.key} className="owner-context-question" role="group" aria-labelledby={`${panelId}-${field.key}`}>
                <p id={`${panelId}-${field.key}`} className="owner-context-q"><b>{field.title}</b>{field.hint && <small>{field.hint}</small>}</p>
                <div className="owner-context-chips">
                  {field.options.map(([code, text]) => {
                    const on = field.multi ? current.includes(code) : current === code;
                    return (
                      <button key={code} type="button" className={`owner-chip${on ? " on" : ""}${field.exclusive?.includes(code) ? " exclusive" : ""}`} aria-pressed={on}
                        onClick={() => set(field.key, field.multi ? toggleOption(current, field.key, code) : on ? null : code)}>
                        {text}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <label className="owner-context-question owner-context-notes">
            <span className="owner-context-q"><b>บันทึกเพิ่มเติม</b><small>{value.notes.length}/{NOTES_MAX}</small></span>
            <textarea value={value.notes} maxLength={NOTES_MAX} rows={3} placeholder="เช่น เริ่มเกาหลังอาบน้ำ" onChange={(event) => set("notes", event.target.value.slice(0, NOTES_MAX))} />
          </label>
        </fieldset>
        {answered > 0 && <button type="button" className="owner-context-reset" disabled={disabled} onClick={() => onChange(emptyOwnerContext())}><RotateCcw size={14} aria-hidden="true" />ล้างข้อมูลประกอบ</button>}
      </div>
    </section>
  );
}
