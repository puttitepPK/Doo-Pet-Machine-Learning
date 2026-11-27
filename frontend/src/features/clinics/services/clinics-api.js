import { GEOAPIFY_API_KEY, SEARCH_RADIUS_METERS, MAX_NEARBY_CLINICS } from '../config.js';
import { distanceKm } from '../utils/map.js';
export async function getNearbyClinics(location) {
  if (!GEOAPIFY_API_KEY) {
    throw new Error("ยังไม่ได้ตั้งค่า Geoapify API key: เพิ่ม VITE_GEOAPIFY_API_KEY ในไฟล์ .env.local แล้วเริ่มแอปใหม่");
  }
  const { lat, lon } = location;
  const params = new URLSearchParams({
    categories: "pet.veterinary",
    filter: `circle:${lon},${lat},${SEARCH_RADIUS_METERS}`,
    bias: `proximity:${lon},${lat}`,
    limit: "20",
    lang: "th",
    apiKey: GEOAPIFY_API_KEY,
  });
  let response;
  try {
    response = await fetch(`https://api.geoapify.com/v2/places?${params}`, { signal: AbortSignal.timeout(15000) });
  } catch {
    throw new Error("เชื่อมต่อ Geoapify ไม่ได้ ตรวจสอบอินเทอร์เน็ตและการตั้งค่าโดเมนของ API key");
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error("Geoapify ปฏิเสธ API key กรุณาตรวจสอบ key และโดเมนที่อนุญาต");
    if (response.status === 429) throw new Error("ใช้โควตา Geoapify ถึงขีดจำกัดแล้ว กรุณาลองใหม่ภายหลัง");
    throw new Error(`Geoapify ค้นหาคลินิกไม่สำเร็จ (HTTP ${response.status}) กรุณาลองใหม่อีกครั้ง`);
  }
  const data = await response.json();
  const features = Array.isArray(data.features) ? data.features : [];
  const seen = new Set();
  return features.flatMap((feature) => {
    const properties = feature.properties || {};
    const raw = properties.datasource?.raw || {};
    const [featureLon, featureLat] = feature.geometry?.coordinates || [];
    const point = { lat: Number(properties.lat ?? featureLat), lon: Number(properties.lon ?? featureLon) };
    const name = properties.name || properties.address_line1 || raw.name;
    if (!name || !Number.isFinite(point.lat) || !Number.isFinite(point.lon)) return [];
    const key = `${name}:${point.lat.toFixed(5)}:${point.lon.toFixed(5)}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{
      id: properties.place_id || key,
      name,
      lat: point.lat,
      lon: point.lon,
      km: distanceKm(location, point),
      hours: properties.opening_hours || raw.opening_hours || "เวลาเปิด-ปิดไม่ได้ระบุ",
      phone: properties.phone || raw.phone || raw["contact:phone"] || "",
      address: properties.address_line2 || properties.formatted || "",
    }];
  }).sort((a, b) => a.km - b.km).slice(0, MAX_NEARBY_CLINICS);
}

