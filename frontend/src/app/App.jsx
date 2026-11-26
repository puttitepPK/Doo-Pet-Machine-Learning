// Load the shared cascade before feature styles, as in the original Header import.
import "../shared/styles/App.css";
import AppRoutes from './routes.jsx';
import { useEffect, useLayoutEffect, useState } from "react";
import { HashRouter, Navigate, useLocation } from "react-router-dom";
import { Header } from "../shared/components/layout/Header.jsx";
import { useAuth } from "../features/auth/hooks/useAuth.js";
import "../shared/styles/Themes.css";

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
 return <>{!isAuthPage && <Header key={user?.id} theme={theme} onCycleTheme={() => setTheme(value => value % 5 + 1)} />}<main className={layoutClass}><AppRoutes user={user} /></main></>;
}

export default function App() {
 const { loading } = useAuth();
 if (loading) return <main role="status">กำลังตรวจสอบบัญชี…</main>;
 return <HashRouter><AppLayout /></HashRouter>;
}

