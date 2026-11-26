import { requireSupabase } from '../lib/supabase.js';
export async function loadOwnedRows(table, columns, order, owner, fallbackColumns) {
  const query = (select) => requireSupabase().from(table).select(select).eq('owner_id', owner).order(order);
  let { data, error } = await query(columns);
  if (error && fallbackColumns && (error.code === '42703' || /column/i.test(error.message ?? ''))) ({ data, error } = await query(fallbackColumns));
  if (error) throw error;
  return data;
}
