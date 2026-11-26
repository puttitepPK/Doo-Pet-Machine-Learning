import { useMemo } from 'react';
import { usePhotoUrls } from "../../../shared/hooks/usePhotoUrls.js";
import { useOwnedRows } from "../../../shared/hooks/useOwnedRows.js";
export function usePets() {
  const pets = useOwnedRows('pets', 'id,name,breed,age,sex,img', 'created_at', 'doo-pet-pets');
  const resolve = usePhotoUrls(pets.rows.map(pet => pet.img));
  const sources = pets.rows.map(pet => resolve(pet.img));
  const urlKey = JSON.stringify(sources);
  const rows = useMemo(() => { const urls = JSON.parse(urlKey); return pets.rows.map((pet, index) => ({ ...pet, imageSource: pet.img, img: urls[index] })); }, [pets.rows, urlKey]);
  return { ...pets, rows };
}
