import { useState } from "react";
import { useAuth } from "../../../features/auth/hooks/useAuth.js";
import { signOut } from "../../../features/auth/services/auth-service.js";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { ChevronRight, ClipboardList, HeartPulse, Info, LogOut, MapPin, Palette, Settings } from "lucide-react";
export function Header({ theme = 1, onCycleTheme }) {
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
      <Link to="/check" className="brand"><img className="brand-symbol" src="/images/branding/doopet-navbar-symbol.png" width="38" height="38" alt="" /><span className="brand-copy"><span className="brand-wordmark">Doo Pet</span><span className="brand-partner">× Machine Learning</span></span></Link>
      <nav aria-label="เมนูหลัก">{items.map(([to, t, Icon]) => <NavLink key={to} to={to} end={to === "/"}><Icon className="mobile-nav-icon" size={21} aria-hidden="true" /><span>{t}</span></NavLink>)}</nav>
      <button type="button" className="theme-cycle" onClick={onCycleTheme} aria-label={`ชุดสีปัจจุบัน: ธีม ${theme} กดเปลี่ยนเป็นธีม ${theme % 5 + 1}`} title={["", "มอคค่า–งาช้าง", "ฟ้า–น้ำเงิน", "เขียวเสจ–ครีม", "ม่วงลาเวนเดอร์", "ชมพูกุหลาบ"][theme]}><Palette size={17} /><span aria-live="polite">ธีม {theme}</span></button>
      <div className="account-wrap">{user ? <><button className="account" aria-label="บัญชีผู้ใช้" aria-expanded={accountOpen} onClick={() => setAccountOpen(!accountOpen)}><img className="account-avatar" src={user.avatar} alt="" /><span className="account-indicator" /></button>{accountOpen && <div className="account-panel"><div className="account-panel-profile"><img src={user.avatar} alt="" /><div><strong>{user.name}</strong><small>{user.email}</small></div></div>{logoutError && <p role="alert">{logoutError}</p>}<div className="account-panel-actions"><Link to="/check" onClick={() => setAccountOpen(false)}><span className="account-action-icon"><HeartPulse size={18} /></span><span>ตรวจสุขภาพน้องหมา</span><ChevronRight size={16} /></Link><Link to="/settings" onClick={() => setAccountOpen(false)}><span className="account-action-icon"><Settings size={18} /></span><span>ตั้งค่าบัญชี</span><ChevronRight size={16} /></Link></div><button type="button" className="account-logout" onClick={logout}><LogOut size={18} /><span>ออกจากระบบ</span></button></div>}</> : <Link to="/login" className="account-login">Login</Link>}</div>
    </header>
  );
}

