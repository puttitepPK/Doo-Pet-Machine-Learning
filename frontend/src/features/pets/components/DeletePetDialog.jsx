import { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
// Deleting is permanent, so the owner must type the pet's exact name before the button unlocks.
export default function DeletePetDialog({ pet, historyCount, busy, error, onCancel, onConfirm }) {
  const ref = useRef(null);
  const titleId = useId();
  const inputId = useId();
  const [typed, setTyped] = useState('');
  const matches = typed.trim() === pet.name.trim();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    dialog?.querySelector('input')?.focus();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);
  return <dialog ref={ref} className="settings-pet-dialog settings-delete-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}>
    <button type="button" className="settings-pet-dialog-close" onClick={onCancel} disabled={busy} aria-label="ปิดหน้าต่างลบสัตว์เลี้ยง"><X size={20} /></button>
    <div className="settings-delete-icon"><Trash2 size={26} /></div>
    <h2 id={titleId}>ลบ {pet.name} ออกจาก My pet?</h2>
    <p className="settings-add-pet-description">การลบนี้ถาวรและย้อนกลับไม่ได้ ข้อมูลและรูปของน้องจะหายไปจากบัญชี และจะเลือกน้องในหน้าตรวจไม่ได้อีก</p>
    {historyCount > 0 && <p className="settings-delete-warning"><AlertTriangle size={17} aria-hidden="true" /><span>จะลบ<strong>ประวัติการตรวจ {historyCount} รายการ</strong>ของ{pet.name} รวมถึงผลวิเคราะห์ คำแนะนำ และรูปผิวหนังที่อัปโหลดไว้ทั้งหมดด้วย ข้อมูลเหล่านี้จะไม่แสดงในหน้าประวัติและกราฟอีก</span></p>}
    <form onSubmit={event => { event.preventDefault(); if (matches && !busy) onConfirm(); }}>
      <label htmlFor={inputId} className="settings-delete-label">พิมพ์ชื่อ <strong>{pet.name}</strong> เพื่อยืนยันการลบ</label>
      <input id={inputId} className="settings-delete-input" value={typed} onChange={event => setTyped(event.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder={pet.name} disabled={busy} aria-invalid={typed !== '' && !matches} />
      {typed !== '' && !matches && <p className="settings-delete-hint">ชื่อยังไม่ตรง ต้องพิมพ์ให้ตรงกับ “{pet.name}”</p>}
      {error && <p role="alert" className="settings-error">{error}</p>}
      <div className="pet-editor-actions"><button className="settings-save danger" type="submit" disabled={!matches || busy}><Trash2 size={16} />{busy ? 'กำลังลบ…' : historyCount > 0 ? 'ลบน้องและประวัติทั้งหมด' : 'ลบถาวร'}</button><button className="settings-save secondary" type="button" onClick={onCancel} disabled={busy}>ยกเลิก</button></div>
    </form>
  </dialog>;
}

