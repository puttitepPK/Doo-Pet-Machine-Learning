import { useEffect, useId, useRef, useState } from 'react';
import { ImageIcon, X, ZoomIn } from 'lucide-react';
import { useAuth } from "../../auth/hooks/useAuth.js";
import { loadHistoryPhoto } from '../services/history-photo.js';
import { fmtDate } from "../../../shared/utils/date.js";

export default function HistoryPhoto({ record }) {
  const { user } = useAuth();
  const owner = user?.id;
  const analysisId = record.analysis_id;
  const synthetic = Boolean(record.care_advice?.synthetic);
  const [state, setState] = useState({});
  const [attempt, setAttempt] = useState(0);
  const dialog = useRef(null);
  const titleId = useId();
  useEffect(() => {
    if (!owner || !analysisId || synthetic) return undefined;
    let active = true;
    async function load() {
      try {
        const photo = await loadHistoryPhoto(owner, analysisId);
        if (active) setState({ owner, analysisId, ...photo });
      } catch {
        if (active) setState({ owner, analysisId, error: true });
      }
    }
    void load();
    const timer = setInterval(() => { void load(); }, 50 * 60 * 1000);
    return () => { active = false; clearInterval(timer); };
  }, [owner, analysisId, synthetic, attempt]);
  const current = state.owner === owner && state.analysisId === analysisId ? state : {};
  if (synthetic || current.missing || !analysisId) return <p className="history-photo-note"><ImageIcon size={15} />{synthetic ? 'ข้อมูลตัวอย่าง ไม่มีรูปตรวจจริง' : 'ไม่มีรูปที่อัปโหลดในรายการนี้'}</p>;
  if (current.error) return <p className="history-photo-note">โหลดรูปไม่สำเร็จ <button type="button" onClick={() => { setState({}); setAttempt(value => value + 1); }}>ลองใหม่</button></p>;
  if (!current.url) return <p className="history-photo-note" role="status">กำลังโหลดรูปที่อัปโหลด…</p>;
  return <div className="history-uploaded-photo">
    <button type="button" className="history-photo-thumb" aria-label={`ดูรูปที่อัปโหลดวันที่ ${fmtDate(record.date)}`} aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>
      <img src={current.url} alt="รูปที่ใช้วิเคราะห์ครั้งนี้" loading="lazy" onError={() => setState({ owner, analysisId, error: true })} />
      <span><ZoomIn size={15} />ดูรูปที่อัปโหลด</span>
    </button>
    <dialog ref={dialog} className="history-photo-dialog" aria-labelledby={titleId}
      onKeyDown={event => event.stopPropagation()}
      onClick={event => { event.stopPropagation(); if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="history-photo-dialog-content">
        <header><div><h2 id={titleId}>รูปที่ใช้วิเคราะห์</h2><p>{fmtDate(record.date)}</p></div><button type="button" autoFocus aria-label="ปิดรูปภาพ" onClick={() => dialog.current?.close()}><X size={22} /></button></header>
        <img src={current.url} alt={`รูปที่อัปโหลดเพื่อตรวจวันที่ ${fmtDate(record.date)}`} />
      </div>
    </dialog>
  </div>;
}
