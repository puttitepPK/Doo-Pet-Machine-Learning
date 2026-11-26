import { useSyncExternalStore } from 'react';
import { usePhotoUrls } from "../../../shared/hooks/usePhotoUrls.js";
import { subscribe, getAuthSnapshot } from '../services/auth-service.js';
export function useAuth() {
  const snapshot = useSyncExternalStore(subscribe, getAuthSnapshot);
  const resolvePhoto = usePhotoUrls([snapshot.user?.avatar]);
  return { ...snapshot, user: snapshot.user ? { ...snapshot.user, avatarSource: snapshot.user.avatar, avatar: resolvePhoto(snapshot.user.avatar) } : null };
}

