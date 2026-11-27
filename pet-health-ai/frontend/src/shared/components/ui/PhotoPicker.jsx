import { useEffect, useId, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { preparePhoto } from "../../services/photo-storage.js";
import { usePhotoUrls } from "../../hooks/usePhotoUrls.js";

export default function PhotoPicker({ value, photo, onChange, disabled, label, onProcessingChange }) {
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const request = useRef(0);
  const inputId = useId();
  const resolve = usePhotoUrls([value]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => () => { request.current += 1; }, []);
  return <div className="settings-photo-upload">
    <img src={photo ? preview || resolve(value) : resolve(value)} alt={label} />
    <div><label className={`settings-photo-button${disabled || processing ? ' disabled' : ''}`} htmlFor={inputId}><Camera size={17} />{processing ? 'กำลังเตรียมรูป…' : 'เลือกรูปจากเครื่อง'}</label>
      <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled || processing} onChange={async event => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        const version = ++request.current;
        setProcessing(true); onProcessingChange?.(true); setError('');
        try { const blob = await preparePhoto(file); if (version === request.current) { setPreview(URL.createObjectURL(blob)); onChange(blob); } }
        catch (failure) { if (version === request.current) setError(failure.message); }
        finally { if (version === request.current) { setProcessing(false); onProcessingChange?.(false); } }
      }} />
      <p>JPG, PNG หรือ WEBP ไม่เกิน 5MB · เลือกแล้วกดบันทึก</p>
      {error && <p className="settings-error" role="alert">{error}</p>}
    </div>
  </div>;
}
