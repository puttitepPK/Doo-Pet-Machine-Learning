import { confidenceLevel } from './confidence.js';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from './auth-session.js';
import { requireSupabase } from './supabase.js';

const empty = [];
// fallbackColumns: used once if the view does not expose a newer column yet (e.g. before migration 010).
export function useOwnedRows(table, columns, order, eventName, fallbackColumns) {
  const { user } = useAuth();
  const owner = user?.id;
  const [state, setState] = useState({});
  useEffect(() => {
    if (!owner) return;
    let active = true;
    let version = 0;
    async function load() {
      const request = ++version;
      try {
        const query = (select) => requireSupabase().from(table).select(select).eq('owner_id', owner).order(order);
        let { data, error } = await query(columns);
        if (error && fallbackColumns && (error.code === '42703' || /column/i.test(error.message ?? ''))) ({ data, error } = await query(fallbackColumns));
        if (error) throw error;
        if (active && request === version) setState({ owner, rows: data });
      } catch {
        if (active && request === version) setState({ owner, error: 'โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่' });
      }
    }
    void load();
    window.addEventListener(eventName, load);
    return () => { active = false; window.removeEventListener(eventName, load); };
  }, [owner, table, columns, order, eventName, fallbackColumns]);
  return {
    rows: owner && state.owner === owner ? state.rows ?? empty : empty,
    loading: Boolean(owner && state.owner !== owner),
    error: owner && state.owner === owner ? state.error : null,
  };
}

export function useHistory() {
  const history = useOwnedRows('doo_pet_history', 'id,pet,date,disease,risk,score,analysis_id,care_advice,owner_context', 'date', 'doo-pet-history', 'id,pet,date,disease,risk,score,analysis_id,care_advice');
  const rows = useMemo(() => history.rows.map(record => ({ ...record, risk: confidenceLevel(record.score) })), [history.rows]);
  return { ...history, rows };
}

// ownerContext (optional) is stored next to the result; it never changes the model output being saved.
export async function saveAnalysis(owner, pet, file, result, risk, advice, ownerContext = null) {
  const client = requireSupabase();
  const bucket = client.storage.from('doo-pet-skin');
  const key = `${owner}/${crypto.randomUUID()}`;
  const upload = await bucket.upload(key, file);
  if (upload.error) throw upload.error;

  const params = {
    p_pet: pet,
    p_image: {
      storage_key: key,
      filename: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      sha256: result.image_sha256,
    },
    p_runs: result.runs,
    p_selected: result.selected_model,
    p_risk: risk,
    p_care_advice: advice,
  };
  let ownerContextSaved = Boolean(ownerContext);
  let { error } = await client.rpc('save_doo_pet_analysis_with_advice', ownerContext ? { ...params, p_owner_context: ownerContext } : params);
  // Database not migrated yet (RPC has no p_owner_context): keep the check result, skip only the extra data.
  if (error && ownerContext && (error.code === 'PGRST202' || error.code === '42883')) {
    ownerContextSaved = false;
    ({ error } = await client.rpc('save_doo_pet_analysis_with_advice', params));
  }
  if (error) {
    await bucket.remove([key]);
    throw error;
  }
  window.dispatchEvent(new Event('doo-pet-history'));
  return { ownerContextSaved };
}
