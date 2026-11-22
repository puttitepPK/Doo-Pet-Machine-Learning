import { usePhotoUrls } from "./photo-storage.js";
import { useSyncExternalStore } from 'react';
import { profileAvatar } from './profile-avatars.js';
import { supabase, requireSupabase } from './supabase.js';

let state = { user: null, loading: Boolean(supabase), recovery: false };
const listeners = new Set();

supabase?.auth.onAuthStateChange((event, session) => {
  const account = session?.user;
  const user = account ? {
    id: account.id,
    email: account.email,
    name: account.user_metadata?.name || account.email?.split('@')[0] || 'ผู้ใช้',
    avatar: profileAvatar(account.user_metadata?.avatar),
  } : null;
  state = { user, loading: false, recovery: Boolean(user && (event === 'PASSWORD_RECOVERY' || state.recovery)) };
  listeners.forEach(listener => listener());
});

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function useAuth() {
  const snapshot = useSyncExternalStore(subscribe, () => state);
  const resolvePhoto = usePhotoUrls([snapshot.user?.avatar]);
  return { ...snapshot, user: snapshot.user ? { ...snapshot.user, avatarSource: snapshot.user.avatar, avatar: resolvePhoto(snapshot.user.avatar) } : null };
}

const redirectTo = () => window.location.origin + window.location.pathname;

export async function authenticate({ name, email, password, signup, remember }) {
  const { auth } = requireSupabase();
  if (remember) sessionStorage.removeItem('doo-pet-session-only');
  else sessionStorage.setItem('doo-pet-session-only', '1');
  const { data, error } = signup
    ? await auth.signUp({ email, password, options: { emailRedirectTo: redirectTo(), data: { name } } })
    : await auth.signInWithPassword({ email, password });
  if (error) throw error;
  return Boolean(data.session);
}

export async function sendPasswordReset(email) {
  const { error } = await requireSupabase().auth.resetPasswordForEmail(email, { redirectTo: redirectTo() });
  if (error) throw error;
}

export async function updateAccount(attributes) {
  const { error } = await requireSupabase().auth.updateUser(attributes);
  if (error) throw error;
  if (attributes.password && state.recovery) {
    state = { ...state, recovery: false };
    listeners.forEach(listener => listener());
  }
}

export async function signOut() {
  const { error } = await requireSupabase().auth.signOut({ scope: 'local' });
  if (error) throw error;
}
