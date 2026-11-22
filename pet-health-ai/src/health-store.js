import { confidenceLevel } from './confidence.js';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from './auth-session.js';
import { requireSupabase } from './supabase.js';

const empty = [];
export function useOwnedRows(table, columns, order, eventName) {
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
        const { data, error } = await requireSupabase().from(table)
          .select(columns).eq('owner_id', owner).order(order);
        if (error) throw error;
        if (active && request === version) setState({ owner, rows: data });
      } catch {
        if (active && request === version) setState({ owner, error: 'โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่' });
      }
    }
    void load();
    window.addEventListener(eventName, load);
    return () => { active = false; window.removeEventListener(eventName, load); };
  }, [owner, table, columns, order, eventName]);
  return {
    rows: owner && state.owner === owner ? state.rows ?? empty : empty,
    loading: Boolean(owner && state.owner !== owner),
    error: owner && state.owner === owner ? state.error : null,
  };
}

export function useHistory() {
  const history = useOwnedRows('doo_pet_history', 'id,pet,date,disease,risk,score,analysis_id,care_advice', 'date', 'doo-pet-history');
  const rows = useMemo(() => history.rows.map(record => ({ ...record, risk: confidenceLevel(record.score) })), [history.rows]);
  return { ...history, rows };
}

export async function saveAnalysis(owner, pet, file, result, risk, advice) {
  const client = requireSupabase();
  const bucket = client.storage.from('doo-pet-skin');
  const key = `${owner}/${crypto.randomUUID()}`;
  const upload = await bucket.upload(key, file);
  if (upload.error) throw upload.error;

  const { error } = await client.rpc('save_doo_pet_analysis_with_advice', {
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
  });
  if (error) {
    await bucket.remove([key]);
    throw error;
  }
  window.dispatchEvent(new Event('doo-pet-history'));
}
