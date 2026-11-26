import { useEffect, useState } from 'react';
import { useAuth } from "../../features/auth/hooks/useAuth.js";
import { loadOwnedRows } from '../services/owned-rows.js';
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
        const data = await loadOwnedRows(table, columns, order, owner, fallbackColumns);
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

