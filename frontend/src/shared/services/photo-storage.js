import { requireSupabase } from '../lib/supabase.js';

const PREFIX = 'pet-photo:';
const BUCKET = 'doo-pet-skin';
export const isStoredPhoto = value => typeof value === 'string' && value.startsWith(PREFIX);
export async function signedPhotoUrl(source) {
  const { data, error } = await requireSupabase().storage.from(BUCKET).createSignedUrl(source.slice(PREFIX.length), 3600);
  return error ? null : data.signedUrl;
}
export async function preparePhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('รองรับรูป JPG, PNG และ WEBP เท่านั้น');
  if (file.size > 5 * 1024 * 1024) throw new Error('กรุณาเลือกรูปขนาดไม่เกิน 5MB');
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error('อ่านรูปไม่ได้ กรุณาเลือกรูปใหม่'); });
  try {
    const scale = Math.min(1, 640 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('เตรียมรูปไม่สำเร็จ')), 'image/webp', .85));
  } finally { bitmap.close(); }
}
export async function uploadPhoto(owner, blob) {
  const path = `${owner}/profile-photos/${crypto.randomUUID()}.webp`;
  const { error } = await requireSupabase().storage.from(BUCKET).upload(path, blob, { contentType: 'image/webp' });
  if (error) throw new Error('อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่');
  return PREFIX + path;
}
export async function discardPhoto(source) {
  if (isStoredPhoto(source)) await requireSupabase().storage.from(BUCKET).remove([source.slice(PREFIX.length)]);
}
