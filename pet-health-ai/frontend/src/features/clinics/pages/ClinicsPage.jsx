import ClinicMap from '../components/ClinicMap.jsx';
import { START_LOCATION, SEARCH_RADIUS_METERS } from '../config.js';
import { formatDistance } from '../utils/map.js';
import { getNearbyClinics } from '../services/clinics-api.js';
import { useMemo, useState } from "react";
import {
  ArrowUpRight, Clock3, LocateFixed, LoaderCircle, MapPin,
  Navigation, PawPrint, Phone, Search, Stethoscope,
} from "lucide-react";
import Dropdown from "../../../shared/components/ui/Dropdown.jsx";

export default function Clinics() {
  const [location, setLocation] = useState(START_LOCATION);
  const [mapCenter, setMapCenter] = useState(START_LOCATION);
  const [hasLocation, setHasLocation] = useState(false);
  const [clinics, setClinics] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [zoom, setZoom] = useState(14);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("distance");

  const locateAndSearch = () => {
    if (!navigator.geolocation) {
      setError("เบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง");
      return;
    }
    setLoading(true);
    setError("");
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      const current = { lat: coords.latitude, lon: coords.longitude };
      setLocation(current);
      setMapCenter(current);
      setHasLocation(true);
      setZoom(14);
      try {
        const results = await getNearbyClinics(current);
        setClinics(results);
        setSelectedId(results[0]?.id ?? null);
        if (results.length === 0) setError("ยังไม่พบข้อมูลคลินิกสัตว์เลี้ยงใกล้ตำแหน่งของคุณ ลองค้นหาอีกครั้งภายหลัง");
      } catch (err) {
        setClinics([]);
        setError(err.message || "ค้นหาคลินิกไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่");
      } finally {
        setLoading(false);
      }
    }, (err) => {
      setLoading(false);
      setError(err.code === 1 ? "กรุณาอนุญาตการเข้าถึงตำแหน่ง เพื่อค้นหาคลินิกใกล้คุณ" : "ระบุตำแหน่งไม่สำเร็จ กรุณาลองอีกครั้ง");
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 });
  };

  const shownClinics = useMemo(() => {
    const filtered = clinics.filter((clinic) => clinic.name.toLowerCase().includes(search.trim().toLowerCase()));
    return filtered.sort((a, b) => sort === "name" ? a.name.localeCompare(b.name, "th") : a.km - b.km);
  }, [clinics, search, sort]);

  const selectClinic = (clinic) => {
    setSelectedId(clinic.id);
    setMapCenter({ lat: clinic.lat, lon: clinic.lon });
  };

  return (
    <div className="clinics-page">
      <section className="clinic-hero">
        <div className="clinic-hero-copy">
          <span className="clinic-hero-icon"><MapPin size={42} fill="currentColor" /></span>
          <div><p className="clinic-eyebrow">PET CARE NEAR YOU</p><h1>ค้นหาคลินิกสัตว์เลี้ยงใกล้ฉัน</h1><p>ดูคลินิกใกล้คุณ พร้อมข้อมูลติดต่อและเส้นทาง</p></div>
        </div>
        <div className="clinic-hero-paw"><PawPrint size={54} /></div>
        <div className="clinic-hero-note">สุขภาพดี<br />เริ่มได้…ที่นี่ <PawPrint size={19} /></div>
      </section>

      <section className="clinic-explorer">
        <article className="clinic-map-panel">
          <h2><MapPin size={20} fill="currentColor" /> แผนที่คลินิกใกล้คุณ</h2>
          <ClinicMap center={mapCenter} location={location} hasLocation={hasLocation} clinics={clinics} selectedId={selectedId} zoom={zoom} onZoom={setZoom} onSelect={selectClinic} onLocate={locateAndSearch} locating={loading} />
        </article>

        <aside className="clinic-results-panel">
          <div className="clinic-results-head">
            <div><h2><PawPrint size={22} /> คลินิกใกล้คุณ</h2><p>{hasLocation ? `แสดง ${clinics.length} แห่งที่ใกล้ที่สุดในรัศมี ${SEARCH_RADIUS_METERS / 1000} กม.` : "เปิดตำแหน่งเพื่อค้นหาคลินิกใกล้คุณ"}</p></div>
            <label className="clinic-sort">เรียงตาม
              <Dropdown value={sort} onChange={setSort} ariaLabel="เรียงคลินิกตาม" options={[{ value: "distance", label: "ระยะใกล้สุด" }, { value: "name", label: "ชื่อคลินิก" }]} />
            </label>
          </div>
          <label className="clinic-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาชื่อคลินิก" aria-label="ค้นหาชื่อคลินิก" /></label>

          {loading && <div className="clinic-status"><LoaderCircle className="spin" size={22} /> กำลังค้นหาคลินิกจาก OpenStreetMap…</div>}
          {!loading && !hasLocation && <div className="clinic-empty"><span><LocateFixed size={26} /></span><b>ค้นหาคลินิกใกล้คุณ</b><p>แตะปุ่มด้านล่างเพื่อใช้ตำแหน่งปัจจุบัน และดูคลินิกสัตว์เลี้ยงที่อยู่ใกล้ที่สุด</p><button onClick={locateAndSearch}><Navigation size={16} /> ใช้ตำแหน่งปัจจุบัน</button></div>}
          {!loading && error && <p className="clinic-error" role="status">{error}</p>}
          {!loading && hasLocation && shownClinics.length > 0 && <div className="clinic-list">
            {shownClinics.map((clinic) => (
              <article key={clinic.id} className={`clinic-result-card ${clinic.id === selectedId ? "active" : ""}`} onClick={() => selectClinic(clinic)}>
                <div className="clinic-card-photo with-image"><img src="/images/clinics/clinic.png" alt="ภาพประกอบคลินิกสัตว์เลี้ยง" /><span>คลินิก</span></div>
                <div className="clinic-card-info">
                  <div className="clinic-card-title"><h3>{clinic.name}</h3><span className="clinic-distance"><MapPin size={13} /> {formatDistance(clinic.km)}</span></div>
                  {clinic.address && <p className="clinic-address">{clinic.address}</p>}
                  <p><Clock3 size={14} /> {clinic.hours}</p>
                  <div className="clinic-card-actions">
                    {clinic.phone ? <a href={`tel:${clinic.phone.replace(/[^\d+]/g, "")}`} onClick={(event) => event.stopPropagation()}><Phone size={14} /> โทร</a> : <span className="clinic-no-phone"><Phone size={14} /> ไม่ระบุเบอร์</span>}
                    <a className="clinic-directions" href={`https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${location.lat}%2C${location.lon}%3B${clinic.lat}%2C${clinic.lon}`} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}><Navigation size={14} /> เส้นทาง <ArrowUpRight size={13} /></a>
                  </div>
                </div>
              </article>
            ))}
          </div>}
          <div className="clinic-data-note"><span><Stethoscope size={16} /></span><p>ข้อมูลคลินิกจาก Geoapify อาจมีรายละเอียดไม่ครบ ควรโทรสอบถามก่อนเดินทาง</p></div>
        </aside>
      </section>
      <footer className="clinic-footer"><span><PawPrint size={23} /></span><b>ดูแลสุขภาพสัตว์เลี้ยงด้วยเทคโนโลยี AI เพื่อเพื่อนสี่ขาในทุกวัน</b><HeartIcon /></footer>
    </div>
  );
}

function HeartIcon() {
  return <span className="clinic-footer-heart">♥</span>;
}
