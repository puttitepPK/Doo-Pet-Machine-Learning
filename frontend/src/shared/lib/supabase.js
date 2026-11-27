import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const storage = {
  getItem: name => sessionStorage.getItem(name) ?? localStorage.getItem(name),
  setItem(name, value) {
    const target = sessionStorage.getItem('doo-pet-session-only') ? sessionStorage : localStorage;
    target.setItem(name, value);
    (target === sessionStorage ? localStorage : sessionStorage).removeItem(name);
  },
  removeItem(name) {
    sessionStorage.removeItem(name);
    localStorage.removeItem(name);
  },
};

export const supabase = url && key ? createClient(url, key, { auth: { storage } }) : null;
export function requireSupabase() {
  if (!supabase) throw new Error('กรุณาตั้งค่า Supabase ใน .env.local แล้วเปิดเว็บใหม่');
  return supabase;
}
