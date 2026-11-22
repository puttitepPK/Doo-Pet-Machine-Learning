import { UserRound } from "lucide-react";
import { ownerContextRows } from "./owner-context.js";
import "./OwnerContext.css";

// "ข้อมูลที่เจ้าของระบุ" — shown apart from the model result and the advice. Renders nothing for old rows (NULL).
export default function OwnerContextSummary({ context }) {
  const rows = ownerContextRows(context);
  if (!rows.length) return null;
  return (
    <section className="owner-summary" aria-label="ข้อมูลที่เจ้าของระบุ">
      <h3><UserRound size={17} aria-hidden="true" />ข้อมูลที่เจ้าของระบุ</h3>
      <dl>
        {rows.map((row) => <div key={row.key} className={row.key === "notes" ? "notes" : ""}><dt>{row.title}</dt><dd>{row.value}</dd></div>)}
      </dl>
      <p>ข้อมูลจากเจ้าของ ไม่ได้ใช้คำนวณผลวิเคราะห์จากภาพ</p>
    </section>
  );
}
