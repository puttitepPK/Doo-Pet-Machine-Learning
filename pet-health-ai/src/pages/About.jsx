import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, ArrowUpRight, Bone, BrainCircuit, Camera, ClipboardList, HeartPulse, History, Layers,
  MapPin, PawPrint, ScanLine, ShieldCheck, Smartphone, Sparkles, Stethoscope,
} from "lucide-react";
import { diseaseName } from "../disease-labels.js";
import { diseaseColor } from "../health-chart.js";
import "./About.css";

const TECH = ["Machine Learning", "Image Classification", "EfficientNet-B3", "FastAPI", "React + Vite", "Supabase"];

const STEPS = [
  { icon: Camera, title: "แนบรูปผิวหนัง", description: "ถ่ายหรือเลือกรูปที่เห็นบริเวณที่กังวลชัดเจน" },
  { icon: ScanLine, title: "ดูผลคัดกรอง", description: "ระบบแสดงกลุ่มผิวหนังที่ภาพมีลักษณะคล้ายที่สุด" },
  { icon: ClipboardList, title: "อ่านคำแนะนำ", description: "สิ่งที่ควรสังเกต วิธีดูแลเบื้องต้น และสิ่งที่ควรเลี่ยง" },
];

// The six classes the classifier was trained on (see README); names come from the shared Thai label map.
const CLASSES = [
  { key: "healthy", group: "normal", en: "Healthy", note: "ผิวหนังและขนดูปกติ ไม่พบลักษณะผิดปกติที่ชัดเจนในภาพ" },
  { key: "dermatitis", group: "allergy", en: "Dermatitis", note: "ผิวแดง ระคายเคือง หรือมีผื่นจากการอักเสบทั่วไป" },
  { key: "hypersensitivity", group: "allergy", en: "Hypersensitivity", note: "อาการแพ้ เช่น แพ้น้ำลายหมัด มักมีอาการคันร่วม" },
  { key: "bacterial_dermatosis", group: "infection", en: "Bacterial dermatosis", note: "ตุ่มหนอง สะเก็ด หรือรอยแดงจากการติดเชื้อแบคทีเรีย" },
  { key: "fungal_infection", group: "infection", en: "Fungal infection", note: "วงขนร่วง ผิวลอกเป็นขุย ลักษณะคล้ายกลากเกลื้อน" },
  { key: "demodicosis", group: "infection", en: "Demodicosis", note: "ขนร่วงเป็นหย่อม ผิวหนาหรือแดง จากไรขุมขน" },
];
const GROUPS = [
  { key: "all", label: "ทั้งหมด" },
  { key: "normal", label: "ผิวปกติ" },
  { key: "allergy", label: "อักเสบ / แพ้" },
  { key: "infection", label: "การติดเชื้อ" },
];

const FEATURES = [
  { icon: ShieldCheck, title: "คัดกรองภาพก่อนวิเคราะห์", text: "ตรวจว่าเป็นภาพสุนัขหรือผิวหนังสุนัขก่อนวิเคราะห์ เพื่อลดผลจากภาพที่ไม่เกี่ยวข้อง" },
  { icon: BrainCircuit, title: "วิเคราะห์ด้วยโมเดลเฉพาะทาง", text: "ใช้ EfficientNet-B3 สำหรับ Image Classification จำแนกภาพผิวหนังสุนัข 6 กลุ่ม พร้อมความมั่นใจของผลวิเคราะห์" },
  { icon: HeartPulse, title: "คำแนะนำการดูแลเบื้องต้น", text: "บอกสิ่งที่ควรสังเกต วิธีดูแล และเมื่อไรควรพบสัตวแพทย์" },
  { icon: History, title: "ประวัติและคลินิกใกล้คุณ", text: "เก็บผลตรวจเป็นรายเดือน และค้นหาคลินิกสัตว์ใกล้ตำแหน่งของคุณ" },
];

// Fade/slide sections in as they scroll into view (skipped when the user prefers reduced motion).
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    const items = [...root.querySelectorAll("[data-reveal]")];
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      items.forEach((item) => item.classList.add("is-in"));
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add("is-in"); observer.unobserve(entry.target); }
      });
    }, { threshold: 0.18, rootMargin: "0px 0px -6% 0px" });
    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);
  return ref;
}

export default function About() {
  const rootRef = useReveal();
  const [group, setGroup] = useState("all");
  const shown = useMemo(() => CLASSES.filter((item) => group === "all" || item.group === group), [group]);

  return (
    <div className="doo-about" ref={rootRef}>
      {/* Hero */}
      <section className="da-hero" aria-labelledby="da-title">
        <div className="da-hero-copy">
          <p className="da-eyebrow"><PawPrint size={14} aria-hidden="true" />เกี่ยวกับระบบ Doo Pet</p>
          <h1 id="da-title">ดูแลผิวหนังน้องหมา<br /><em>เริ่มจากรูปเดียว</em></h1>
          <p className="da-lead">Doo Pet ช่วยคัดกรองลักษณะผิวหนังสุนัขจากภาพ พร้อมคำแนะนำในการสังเกตอาการและดูแลเบื้องต้นสำหรับเจ้าของ</p>
          <div className="da-actions">
            <Link className="da-btn" to="/check">เริ่มตรวจสุขภาพ<ArrowUpRight size={18} aria-hidden="true" /></Link>
            <Link className="da-btn ghost" to="/history">ดูประวัติการตรวจ</Link>
          </div>
        </div>
        <div className="da-hero-art" aria-hidden="true">
          <span className="da-hero-disc" />
          <span className="da-dot d1" /><span className="da-dot d2" /><span className="da-dot d3" /><span className="da-dot d4" />
          <PawPrint className="da-hero-paw p1" size={26} /><PawPrint className="da-hero-paw p2" size={18} />
          <img src="/dogs/golden-dog-cutout.png" alt="" fetchPriority="high" />
          <span className="da-hero-tag"><Sparkles size={15} />วิเคราะห์ภาพด้วย ML</span>
        </div>
      </section>

      <ul className="da-tech" aria-label="เทคโนโลยีที่ใช้" data-reveal>
        {TECH.map((name) => <li key={name}><Layers size={15} aria-hidden="true" />{name}</li>)}
      </ul>

      {/* App + how it works */}
      <section className="da-app" aria-labelledby="da-app-title">
        <div className="da-phones" data-reveal aria-hidden="true">
          <span className="da-phones-glow" />
          <img className="da-phone back" src="/about/about-phone-settings.webp" alt="" loading="lazy" />
          <img className="da-phone front" src="/about/about-phone-check.webp" alt="" loading="lazy" />
        </div>
        <div className="da-app-copy" data-reveal>
          <p className="da-kicker"><Smartphone size={14} aria-hidden="true" />ใช้งานได้ทุกอุปกรณ์</p>
          <h2 id="da-app-title">ตรวจได้ทันที<br />จากมือถือของคุณ</h2>
          <p className="da-text">ออกแบบให้ใช้งานง่ายในไม่กี่ขั้นตอน ถ่ายรูปผิวหนังน้อง รอผลไม่นาน แล้วอ่านคำแนะนำที่เข้าใจง่าย</p>
          <ol className="da-steps">
            {STEPS.map(({ icon: Icon, title, description }, index) => (
              <li key={title} style={{ "--d": `${index * 90}ms` }}>
                <span className="da-step-no">{index + 1}</span>
                <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
                <div><h3>{title}</h3><p>{description}</p></div>
              </li>
            ))}
          </ol>
          <Link className="da-btn" to="/check">ลองตรวจเลย<ArrowRight size={18} aria-hidden="true" /></Link>
        </div>
      </section>

      {/* Classes */}
      <section className="da-classes" aria-labelledby="da-classes-title">
        <div className="da-center" data-reveal>
          <p className="da-kicker"><Stethoscope size={14} aria-hidden="true" />ขอบเขตของโมเดล</p>
          <h2 id="da-classes-title">ลักษณะผิวหนังที่ระบบคัดกรองได้</h2>
          <p className="da-text">โมเดลจำแนกภาพผิวหนังสุนัขออกเป็น 6 กลุ่ม เพื่อช่วยให้เจ้าของสังเกตอาการได้เร็วขึ้น ไม่ใช่การวินิจฉัยโรค</p>
          <div className="da-chips" role="group" aria-label="กรองกลุ่มผิวหนัง">
            {GROUPS.map((item) => (
              <button key={item.key} type="button" className={group === item.key ? "on" : ""} aria-pressed={group === item.key} onClick={() => setGroup(item.key)}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <ul className="da-class-grid" key={group}>
          {shown.map((item, index) => (
            <li key={item.key} className="da-class" style={{ "--c": diseaseColor(item.key), "--d": `${index * 60}ms` }}>
              <span className="da-class-icon" aria-hidden="true">{item.group === "normal" ? <ShieldCheck size={22} /> : <ScanLine size={22} />}</span>
              <small>{item.en}</small>
              <h3>{diseaseName(item.key)}</h3>
              <p>{item.note}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Key features */}
      <section className="da-features" aria-labelledby="da-features-title">
        <div data-reveal>
          <p className="da-kicker"><Bone size={14} aria-hidden="true" />ใส่ใจทุกขั้นตอน</p>
          <h2 id="da-features-title">จุดเด่นของระบบ</h2>
          <p className="da-text narrow">ออกแบบโดยคำนึงถึงความปลอดภัยของน้อง และความเข้าใจง่ายสำหรับเจ้าของ</p>
        </div>
        <ul className="da-feature-grid">
          {FEATURES.map(({ icon: Icon, title, text }, index) => (
            <li key={title} data-reveal style={{ "--d": `${index * 90}ms` }}>
              <span className="da-feature-icon" aria-hidden="true"><Icon size={22} strokeWidth={1.8} /></span>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* CTA */}
      <section className="da-cta" aria-labelledby="da-cta-title" data-reveal>
        <span className="da-cta-ring r1" aria-hidden="true" /><span className="da-cta-ring r2" aria-hidden="true" />
        <PawPrint className="da-cta-paw" size={120} aria-hidden="true" />
        <h2 id="da-cta-title">เริ่มดูแลน้องกับ Doo Pet วันนี้</h2>
        <p>แนบรูปผิวหนังเพียงรูปเดียว ระบบช่วยคัดกรองและแนะนำการดูแลเบื้องต้นให้ทันที</p>
        <Link className="da-btn light" to="/check"><PawPrint size={17} aria-hidden="true" />เริ่มตรวจสุขภาพ</Link>
        <p className="da-cta-scope"><ShieldCheck size={16} aria-hidden="true" />ระบบประเมินเฉพาะลักษณะผิวหนังสุนัขที่เห็นในภาพ หากอาการยังอยู่หรือแย่ลง ควรให้สัตวแพทย์ตรวจเพื่อวินิจฉัย</p>
      </section>

      {/* Footer */}
      <footer className="da-footer" data-reveal>
        <div className="da-footer-brand">
          <strong>Doo Pet <Bone size={18} aria-hidden="true" /></strong>
          <span>× Machine Learning</span>
          <p>โปรเจกต์คัดกรองผิวหนังสุนัขเบื้องต้นจากภาพ</p>
        </div>
        <nav aria-label="ลิงก์ในระบบ">
          <Link to="/check"><HeartPulse size={15} aria-hidden="true" />ตรวจสุขภาพ</Link>
          <Link to="/history"><History size={15} aria-hidden="true" />ประวัติการตรวจ</Link>
          <Link to="/clinics"><MapPin size={15} aria-hidden="true" />คลินิกใกล้ฉัน</Link>
        </nav>
      </footer>
    </div>
  );
}
