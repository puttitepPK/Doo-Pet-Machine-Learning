import { Routes, Route, Navigate } from 'react-router-dom';
import Check from "../features/analysis/pages/CheckPage.jsx";
import History from "../features/history/pages/HistoryPage.jsx";
import Clinics from "../features/clinics/pages/ClinicsPage.jsx";
import About from "../features/about/pages/AboutPage.jsx";
import Settings from "../features/settings/pages/SettingsPage.jsx";
import Auth from "../features/auth/pages/AuthPage.jsx";

export default function AppRoutes({ user }) {
  return <Routes key={user?.id}><Route path="/" element={<Navigate to="/check" replace />} /><Route path="/check" element={<Check />} /><Route path="/history" element={<History />} /><Route path="/clinics" element={<Clinics />} /><Route path="/settings" element={<Settings />} /><Route path="/about" element={<About />} /><Route path="/login" element={<Auth key="login" />} /><Route path="/signup" element={<Auth key="signup" mode="signup" />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes>;
}
