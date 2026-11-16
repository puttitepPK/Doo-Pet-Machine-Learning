import { ArrowUpRight, Camera, ScanLine, ClipboardList, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import "./About.css";

const steps = [
  { icon: Camera, title: "แนบรูปผิวหนัง", description: "เลือกรูปที่เห็นบริเวณที่กังวลชัดเจน" },
  { icon: ScanLine, title: "ดูผลคัดกรอง", description: "ระบบแสดงกลุ่มผิวหนังที่ภาพมีลักษณะคล้ายที่สุด" },
  { icon: ClipboardList, title: "อ่านคำแนะนำ", description: "ดูสิ่งที่ควรสังเกต วิธีดูแลเบื้องต้น และสิ่งที่ควรเลี่ยง" },
];

export default function About() {
  return (
    <div className="doo-about">
      <section className="doo-about-hero" aria-labelledby="doo-about-title">
        <div className="doo-about-intro">
          <p className="doo-about-label">เกี่ยวกับระบบ</p>
          <h1 id="doo-about-title">ดูแลผิวหนังน้องหมา <em>เริ่มจากรูปเดียว</em></h1>
          <p className="doo-about-description">Doo Pet ช่วยคัดกรองลักษณะผิวหนังสุนัขจากภาพ พร้อมคำแนะนำในการสังเกตอาการและดูแลเบื้องต้นสำหรับเจ้าของ</p>
          <Link className="doo-about-action" to="/check">
            เริ่มตรวจสุขภาพ <ArrowUpRight size={20} aria-hidden="true" />
          </Link>
        </div>
        <figure className="doo-about-portrait">
          <img src="/dogs/about-dog.jpg" alt="สุนัขโกลเด้นรีทรีฟเวอร์" fetchPriority="high" />
        </figure>
      </section>

      <section className="doo-about-workflow" aria-labelledby="doo-about-workflow-title">
        <h2 id="doo-about-workflow-title">ระบบทำงานอย่างไร</h2>
        <ol>
          {steps.map(({ icon: Icon, title, description }, index) => (
            <li key={title}>
              <div className="doo-about-step-sign">
                <Icon size={22} strokeWidth={1.7} aria-hidden="true" />
                <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              </div>
              <div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <aside className="doo-about-scope" aria-labelledby="doo-about-scope-title">
        <ShieldCheck size={24} strokeWidth={1.7} aria-hidden="true" />
        <div>
          <h2 id="doo-about-scope-title">ขอบเขตการคัดกรอง</h2>
          <p>ระบบประเมินเฉพาะลักษณะผิวหนังสุนัขที่เห็นในภาพ หากอาการยังอยู่หรือแย่ลง ควรให้สัตวแพทย์ตรวจเพื่อวินิจฉัย</p>
        </div>
      </aside>
    </div>
  );
}
