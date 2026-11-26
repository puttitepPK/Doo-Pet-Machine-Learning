import { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, Stethoscope, Plus, Minus, LoaderCircle, LocateFixed, Navigation } from 'lucide-react';
import { TILE_SIZE, GEOAPIFY_API_KEY } from '../config.js';
import { toWorldPixel } from '../utils/map.js';
export default function ClinicMap({ center, location, hasLocation, clinics, selectedId, zoom, onZoom, onSelect, onLocate, locating }) {
  const mapRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!mapRef.current) return undefined;
    const observer = new ResizeObserver(([entry]) => setSize({
      width: entry.contentRect.width,
      height: entry.contentRect.height,
    }));
    observer.observe(mapRef.current);
    return () => observer.disconnect();
  }, []);

  const centerPoint = useMemo(() => toWorldPixel(center.lat, center.lon, zoom), [center, zoom]);
  const mapTiles = useMemo(() => {
    if (!size.width || !size.height) return [];
    const tileX = Math.floor(centerPoint.x / TILE_SIZE);
    const tileY = Math.floor(centerPoint.y / TILE_SIZE);
    const columns = Math.ceil(size.width / TILE_SIZE) + 2;
    const rows = Math.ceil(size.height / TILE_SIZE) + 2;
    const startX = -Math.floor(columns / 2);
    const startY = -Math.floor(rows / 2);
    const offsetX = size.width / 2 - (centerPoint.x - tileX * TILE_SIZE);
    const offsetY = size.height / 2 - (centerPoint.y - tileY * TILE_SIZE);
    const count = 2 ** zoom;
    const tiles = [];
    for (let dx = startX; dx < startX + columns; dx += 1) {
      for (let dy = startY; dy < startY + rows; dy += 1) {
        const y = tileY + dy;
        if (y < 0 || y >= count) continue;
        const x = ((tileX + dx) % count + count) % count;
        tiles.push({ key: `${zoom}/${x}/${y}`, x, y, left: offsetX + dx * TILE_SIZE, top: offsetY + dy * TILE_SIZE });
      }
    }
    return tiles;
  }, [centerPoint, size, zoom]);

  const markerPosition = (clinic) => {
    const point = toWorldPixel(clinic.lat, clinic.lon, zoom);
    const worldSize = TILE_SIZE * 2 ** zoom;
    let dx = point.x - centerPoint.x;
    if (dx > worldSize / 2) dx -= worldSize;
    if (dx < -worldSize / 2) dx += worldSize;
    return { left: size.width / 2 + dx, top: size.height / 2 + point.y - centerPoint.y };
  };
  const userPosition = markerPosition(location);

  return (
    <div className="clinic-map" ref={mapRef}>
      <div className="clinic-map-tiles" aria-hidden="true">
        {mapTiles.map((tile) => <img key={tile.key} src={GEOAPIFY_API_KEY ? `https://maps.geoapify.com/v1/tile/osm-carto/${tile.key}.png?apiKey=${encodeURIComponent(GEOAPIFY_API_KEY)}` : `https://tile.openstreetmap.org/${tile.key}.png`} alt="" draggable="false" style={{ left: tile.left, top: tile.top }} />)}
      </div>
      <div className="clinic-map-grid" aria-hidden="true" />
      {size.width > 0 && clinics.map((clinic) => {
        const position = markerPosition(clinic);
        if (position.left < -24 || position.left > size.width + 24 || position.top < -42 || position.top > size.height + 10) return null;
        return <button key={clinic.id} className={`clinic-map-marker ${clinic.id === selectedId ? "selected" : ""}`} style={position} onClick={() => onSelect(clinic)} aria-label={`เลือก ${clinic.name}`} title={clinic.name}><MapPin size={23} fill="currentColor" /><span><Stethoscope size={12} /></span></button>;
      })}
      {hasLocation && <div className="clinic-you-marker" style={userPosition} aria-label="ตำแหน่งของคุณ"><span /><b>คุณอยู่ที่นี่</b></div>}
      <div className="clinic-map-controls">
        <button onClick={() => onZoom(Math.min(18, zoom + 1))} aria-label="ซูมเข้า"><Plus size={19} /></button>
        <button onClick={() => onZoom(Math.max(3, zoom - 1))} aria-label="ซูมออก"><Minus size={19} /></button>
        <button className="locate-map-button" onClick={onLocate} disabled={locating} aria-label="ค้นหาตำแหน่งปัจจุบัน">{locating ? <LoaderCircle className="spin" size={18} /> : <LocateFixed size={19} />}</button>
      </div>
      <button className="clinic-locate-hint" onClick={onLocate} disabled={locating}>
        {locating ? <LoaderCircle className="spin" size={16} /> : <Navigation size={16} />}
        {locating ? "กำลังค้นหาคลินิกใกล้คุณ…" : "ค้นหาคลินิกใกล้ตำแหน่งปัจจุบัน"}
      </button>
      <span className="clinic-attribution">{GEOAPIFY_API_KEY ? <><a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">Powered by Geoapify</a> · </> : null}<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a></span>
    </div>
  );
}

