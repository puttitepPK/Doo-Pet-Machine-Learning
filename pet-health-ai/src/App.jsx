import { useEffect, useLayoutEffect, useState } from "react";
import { HashRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Header } from "./shared.jsx";
import Check from "./pages/Check.jsx";
import History from "./pages/History.jsx";
import Clinics from "./pages/Clinics.jsx";
import About from "./pages/About.jsx";
import Settings from "./pages/Settings.jsx";
import Auth from "./pages/Auth.jsx";
import { useAuth } from "./auth-session.js";
import "./App.css";
import "./Themes.css";

function AppLayout() {
 const { pathname } = useLocation();
 const { user, recovery } = useAuth();
 const [theme, setTheme] = useState(() => {
   try { const saved = Number(localStorage.getItem('pet-health-theme')); return [1, 2, 3, 4, 5].includes(saved) ? saved : 1; }
   catch { return 1; }
 });
 useEffect(() => {
   try { localStorage.setItem('pet-health-theme', String(theme)); } catch { /* Keep switching available without storage. */ }
 }, [theme]);
 useLayoutEffect(() => {
   document.documentElement.dataset.theme = String(pathname === '/login' ? 1 : theme);
 }, [pathname, theme]);
 const isAuthPage = pathname === '/login' || pathname === '/signup';
 const layoutClass = isAuthPage ? 'auth-layout' : `page-layout page-layout-${pathname === '/' ? 'home' : pathname.slice(1)}`;
 if (recovery && pathname !== "/settings") return <Navigate to="/settings" replace />;
 return <>{!isAuthPage && <Header key={user?.id} theme={theme} onCycleTheme={() => setTheme(value => value % 5 + 1)} />}<main className={layoutClass}><Routes key={user?.id}><Route path="/" element={<Navigate to="/check" replace />} /><Route path="/check" element={<Check />} /><Route path="/history" element={<History />} /><Route path="/clinics" element={<Clinics />} /><Route path="/settings" element={<Settings />} /><Route path="/about" element={<About />} /><Route path="/login" element={<Auth key="login" />} /><Route path="/signup" element={<Auth key="signup" mode="signup" />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes></main></>;
}

export default function App() {
 const { loading } = useAuth();
 if (loading) return <main role="status">กำลังตรวจสอบบัญชี…</main>;
 return <HashRouter><AppLayout /></HashRouter>;
}

