import { requireSupabase } from '../../../shared/lib/supabase.js';
export async function loadHistoryPhoto(owner, analysisId) {
  const client = requireSupabase();
  const { data, error } = await client.from('analyses')
    .select('id,skin_images(storage_key,original_filename)')
    .eq('id', analysisId).eq('requested_by', owner).maybeSingle();
  if (error) throw error;
  const image = Array.isArray(data?.skin_images) ? data.skin_images[0] : data?.skin_images;
  if (!image?.storage_key || image.storage_key.includes('/seed-') || image.storage_key.includes('/demo-history-')) {
    return { missing: true };
  }
  const signed = await client.storage.from('doo-pet-skin').createSignedUrl(image.storage_key, 3600);
  if (signed.error || !signed.data?.signedUrl) throw new Error('Image unavailable');
  return { url: signed.data.signedUrl };
}
