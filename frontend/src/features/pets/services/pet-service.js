import { requireSupabase } from '../../../shared/lib/supabase.js';
export async function savePet(owner, { id, ...pet }) {
  const table = requireSupabase().from('pets');
  const query = id ? table.update(pet).eq('owner_id', owner).eq('id', id) : table.insert({ ...pet, owner_id: owner });
  const { data, error } = await query.select('id').single();
  if (error) throw error;
  window.dispatchEvent(new Event('doo-pet-pets'));
  return data.id;
}

// Permanently removes one pet together with all of its check history and uploaded skin photos.
// The database function deletes everything in one transaction (all or nothing) and only for the signed-in owner,
// then returns the storage keys of the uploaded photos so they can be removed from Storage as well.
export async function deletePet(owner, id) {
  const client = requireSupabase();
  const { data, error } = await client.rpc('delete_doo_pet', { p_pet: String(id) });
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') throw new Error('ฐานข้อมูลยังไม่มีฟังก์ชันลบสัตว์เลี้ยง ผู้ดูแลระบบต้องรัน database/009_delete_pet_with_history.sql ใน Supabase ก่อน');
    if (error.code === 'P0002') throw new Error('ไม่พบสัตว์เลี้ยงตัวนี้ในบัญชีของคุณ อาจถูกลบไปแล้ว');
    if (error.code === '42501') throw new Error('บัญชีนี้ไม่มีสิทธิ์ลบสัตว์เลี้ยงตัวนี้');
    if (error.code === '23503') throw new Error('ลบไม่สำเร็จ ข้อมูลทั้งหมดยังอยู่ครบ เพราะมีข้อมูลอื่นในระบบผูกกับประวัติของน้อง กรุณาแจ้งผู้ดูแลระบบ');
    throw new Error(error.message || 'ลบสัตว์เลี้ยงไม่สำเร็จ ข้อมูลยังอยู่ครบ กรุณาลองใหม่');
  }
  const keys = (Array.isArray(data) ? data : []).filter((key) => typeof key === 'string' && key.startsWith(`${owner}/`));
  for (let start = 0; start < keys.length; start += 100) {
    await client.storage.from('doo-pet-skin').remove(keys.slice(start, start + 100)).catch(() => {});
  }
  window.dispatchEvent(new Event('doo-pet-pets'));
  window.dispatchEvent(new Event('doo-pet-history'));
}
