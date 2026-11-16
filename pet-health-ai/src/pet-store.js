import { useOwnedRows } from './health-store.js';
import { requireSupabase } from './supabase.js';

export const DEFAULT_PETS = [
  { id: 1, name: "Milo", breed: "Shih Tzu", age: 4, sex: "ผู้", img: "/dogs/Milpo.png" },
  { id: 2, name: "Buddy", breed: "Golden Retriever", age: 3, sex: "ผู้", img: "/dogs/Buddy.png" },
  { id: 3, name: "Luna", breed: "Siberian Husky", age: 2, sex: "เมีย", img: "/dogs/Luna.png" },
  { id: 4, name: "Choco", breed: "Corgi", age: 1, sex: "ผู้", img: "/dogs/Choco.png" },
];


export function usePets() {
  return useOwnedRows('pets', 'id,name,breed,age,sex,img', 'created_at', 'doo-pet-pets');
}
export async function savePet(owner, { id, ...pet }) {
  const table = requireSupabase().from('pets');
  const query = id ? table.update(pet).eq('owner_id', owner).eq('id', id) : table.insert({ ...pet, owner_id: owner });
  const { data, error } = await query.select('id').single();
  if (error) throw error;
  window.dispatchEvent(new Event('doo-pet-pets'));
  return data.id;
}
