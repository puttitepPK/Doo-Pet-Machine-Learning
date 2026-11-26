import { isStoredPhoto } from "../../../shared/services/photo-storage.js";
export const PROFILE_AVATARS = [
  { src: '/images/avatars/profile-1.png', label: 'หนุ่มแว่น เสื้อครีม' },
  { src: '/images/avatars/profile-2.png', label: 'ฮู้ดสีดำ' },
  { src: '/images/avatars/profile-3.png', label: 'สาวผมสั้น แว่นดำ' },
  { src: '/images/avatars/profile-4.png', label: 'สาวผมยาว เสื้อครีม' },
  { src: '/images/avatars/profile-red-bandana.png', label: 'ผ้าโพกหัวสีแดง' },
];
export const profileAvatar = value => (isStoredPhoto(value) || (typeof value === "string" && value.startsWith(import.meta.env.VITE_SUPABASE_URL + "/storage/v1/object/sign/doo-pet-skin/")) || PROFILE_AVATARS.some(item => item.src === value || item.src.replace("/images/avatars/", "/avatars/") === value)) ? value : PROFILE_AVATARS[0].src;
