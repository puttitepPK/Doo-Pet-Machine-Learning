import { useEffect, useState } from 'react';
import { isStoredPhoto, signedPhotoUrl } from '../services/photo-storage.js';
export function usePhotoUrls(sources) {
  const key = JSON.stringify([...new Set(sources.filter(isStoredPhoto))].sort());
  const [urls, setUrls] = useState({});
  useEffect(() => {
    const paths = JSON.parse(key);
    if (!paths.length) return undefined;
    let active = true;
    async function load() {
      const entries = await Promise.all(paths.map(async source => {
        return [source, await signedPhotoUrl(source)];
      }));
      if (active) setUrls(Object.fromEntries(entries));
    }
    void load().catch(() => {});
    const timer = setInterval(() => { void load().catch(() => {}); }, 50 * 60 * 1000);
    return () => { active = false; clearInterval(timer); };
  }, [key]);
  return source => isStoredPhoto(source) ? urls[source] || '/images/pets/Buddy.png' : source;
}
