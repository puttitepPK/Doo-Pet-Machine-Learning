import { requireSupabase } from '../../../shared/lib/supabase.js';

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
