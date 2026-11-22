import { DEFAULT_PETS } from "./pet-store.js";
import { useState } from "react";
import { useAuth, signOut } from "./auth-session.js";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { AlertCircle, ChevronRight, ClipboardList, HeartPulse, Info, LogOut, MapPin, Palette, Settings } from "lucide-react";
import "./App.css";

/* ---------- ข้อมูลตัวอย่าง (แทนที่ด้วยข้อมูลจาก API ภายหลัง) ---------- */
const PETS = DEFAULT_PETS;
const HISTORY = [
  { id: 1, pet: 1, date: "2025-09-20T14:32", disease: "Skin Infection", risk: "mid" },
  { id: 2, pet: 2, date: "2025-09-15T10:21", disease: "Ear Infection", risk: "low" },
  { id: 3, pet: 3, date: "2025-09-05T16:45", disease: "Eye Irritation", risk: "high" },
  { id: 4, pet: 4, date: "2025-08-28T11:12", disease: "Healthy", risk: "low" },
];
const CLINICS = [
  { name: "Pet Care Animal Hospital", km: 0.8, rate: 4.8, n: 124, hours: "08:00 – 22:00", tel: "02-123-4567", x: 30, y: 28 },
  { name: "โรงพยาบาลสัตว์บางนอกเพ็ท", km: 1.2, rate: 4.6, n: 96, hours: "09:00 – 20:00", tel: "02-345-6789", x: 64, y: 44 },
  { name: "คลินิกรักษาสัตว์หมอโย", km: 1.8, rate: 4.5, n: 74, hours: "09:00 – 19:00", tel: "02-987-6543", x: 42, y: 68 },
];
const RISK = { low: "ความมั่นใจต่ำ", mid: "ความมั่นใจกลาง", high: "ความมั่นใจสูง" };
const ADVICE = {
  "Skin Infection": [
    "แยกน้องออกจากสัตว์เลี้ยงตัวอื่นชั่วคราว เพื่อลดการแพร่เชื้อ",
    "อย่าทายาหรือใช้แชมพูยาเองก่อนปรึกษาสัตวแพทย์",
    "ซักและตากผ้าปูที่นอนให้แห้งสนิท",
    "ถ้ารอยโรคลามหรือน้องเกาไม่หยุด ควรพบสัตวแพทย์ภายใน 1–2 วัน",
  ],
  default: ["สังเกตอาการต่อเนื่อง 2–3 วัน", "ถ่ายรูปบริเวณที่สงสัยไว้เทียบ", "หากอาการแย่ลง ให้พบสัตวแพทย์"],
};

const fmtDate = (s) =>
  new Date(s).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/* ---------- ส่วนประกอบย่อย ---------- */
function Avatar({ pet, size = 64 }) {
  const [bad, setBad] = useState(false);
  return bad ? (
    <span className="avatar" style={{ width: size, height: size }}>{pet.name[0]}</span>
  ) : (
    <img className="avatar" style={{ width: size, height: size }} src={pet.img} alt={pet.name} onError={() => setBad(true)} />
  );
}
const Risk = ({ level }) => <span className={`risk risk-${level}`}>{RISK[level] || "ไม่ระบุความมั่นใจ"}</span>;
const Disclaimer = ({ children }) => (
  <p className="notice"><AlertCircle size={18} />{children}</p>
);
const PageHead = ({ icon: Icon, title, sub }) => (
  <div className="page-head"><span className="badge"><Icon size={22} /></span><div><h1>{title}</h1><p>{sub}</p></div></div>
);

function Header({ theme = 1, onCycleTheme }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [accountOpen, setAccountOpen] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  async function logout() {
    try {
      await signOut();
      navigate('/login', { replace: true });
      window.scrollTo(0, 0);
    } catch {
      setLogoutError('ออกจากระบบไม่สำเร็จ กรุณาลองใหม่');
    }
  }
  const items = [["/check", "ตรวจสุขภาพ", HeartPulse], ["/history", "ประวัติการตรวจ", ClipboardList], ["/clinics", "คลินิกใกล้ฉัน", MapPin], ["/about", "เกี่ยวกับระบบ", Info]];
  return (
    <header className="top">
      <Link to="/check" className="brand"><img className="brand-symbol" src="/dogs/doopet-navbar-symbol.png" width="38" height="38" alt="" /><span className="brand-copy"><span className="brand-wordmark">Doo Pet</span><span className="brand-partner">× Machine Learning</span></span></Link>
      <nav aria-label="เมนูหลัก">{items.map(([to, t, Icon]) => <NavLink key={to} to={to} end={to === "/"}><Icon className="mobile-nav-icon" size={21} aria-hidden="true" /><span>{t}</span></NavLink>)}</nav>
      <button type="button" className="theme-cycle" onClick={onCycleTheme} aria-label={`ชุดสีปัจจุบัน: ธีม ${theme} กดเปลี่ยนเป็นธีม ${theme % 5 + 1}`} title={["", "มอคค่า–งาช้าง", "ฟ้า–น้ำเงิน", "เขียวเสจ–ครีม", "ม่วงลาเวนเดอร์", "ชมพูกุหลาบ"][theme]}><Palette size={17} /><span aria-live="polite">ธีม {theme}</span></button>
      <div className="account-wrap">{user ? <><button className="account" aria-label="บัญชีผู้ใช้" aria-expanded={accountOpen} onClick={() => setAccountOpen(!accountOpen)}><img className="account-avatar" src={user.avatar} alt="" /><span className="account-indicator" /></button>{accountOpen && <div className="account-panel"><div className="account-panel-profile"><img src={user.avatar} alt="" /><div><strong>{user.name}</strong><small>{user.email}</small></div></div>{logoutError && <p role="alert">{logoutError}</p>}<div className="account-panel-actions"><Link to="/check" onClick={() => setAccountOpen(false)}><span className="account-action-icon"><HeartPulse size={18} /></span><span>ตรวจสุขภาพน้องหมา</span><ChevronRight size={16} /></Link><Link to="/settings" onClick={() => setAccountOpen(false)}><span className="account-action-icon"><Settings size={18} /></span><span>ตั้งค่าบัญชี</span><ChevronRight size={16} /></Link></div><button type="button" className="account-logout" onClick={logout}><LogOut size={18} /><span>ออกจากระบบ</span></button></div>}</> : <Link to="/login" className="account-login">Login</Link>}</div>
    </header>
  );
}

/* ---------- หน้าหลัก ---------- */

export { PETS, HISTORY, CLINICS, RISK, ADVICE, fmtDate, Avatar, Risk, Disclaimer, PageHead, Header };
