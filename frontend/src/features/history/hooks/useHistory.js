import { useMemo } from 'react';
import { confidenceLevel } from '../../../shared/utils/confidence.js';
import { useOwnedRows } from "../../../shared/hooks/useOwnedRows.js";
export function useHistory() {
  const history = useOwnedRows('doo_pet_history', 'id,pet,date,disease,risk,score,analysis_id,care_advice,owner_context', 'date', 'doo-pet-history', 'id,pet,date,disease,risk,score,analysis_id,care_advice');
  const rows = useMemo(() => history.rows.map(record => ({ ...record, risk: confidenceLevel(record.score) })), [history.rows]);
  return { ...history, rows };
}

