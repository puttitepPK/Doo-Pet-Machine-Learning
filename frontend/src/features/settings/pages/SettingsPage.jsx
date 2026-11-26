import PetEditor from '../../pets/components/PetEditor.jsx';
import DeletePetDialog from '../../pets/components/DeletePetDialog.jsx';
import PhotoPicker from "../../../shared/components/ui/PhotoPicker.jsx";
import { uploadPhoto, discardPhoto } from "../../../shared/services/photo-storage.js";
import { PROFILE_AVATARS, profileAvatar } from "../../auth/utils/profile-avatars.js";
import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { Bone, UserRound, Mail, LockKeyhole, PawPrint, Plus, Pencil, Check, ChevronRight, Save, ShieldCheck, Trash2, X } from "lucide-react";
import { useAuth } from "../../auth/hooks/useAuth.js";
import { updateAccount } from "../../auth/services/auth-service.js";
import { deletePet } from "../../pets/services/pet-service.js";
import { savePet as persistPet } from "../../pets/services/pet-service.js";
import { usePets } from "../../pets/hooks/usePets.js";
import { useHistory } from "../../history/hooks/useHistory.js";
import "../styles/Settings.css";

export default function Settings() {
  const { user, recovery } = useAuth();
  const [avatar, setAvatar] = useState(() => profileAvatar(user?.avatarSource || user?.avatar));
  const [avatarPhoto, setAvatarPhoto] = useState(null);
  const [avatarPreparing, setAvatarPreparing] = useState(false);
  const isAvatarSelected = source => avatar === source || avatar === source.replace('/images/avatars/', '/avatars/');
  const { rows: pets, loading, error: petError } = usePets();
  const { rows: history } = useHistory();
  const [deleting, setDeleting] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const addDialog = useRef(null);
  const addButton = useRef(null);
  const [tab, setTab] = useState('account');
  const [editingId, setEditingId] = useState(pets[0]?.id);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const animal = pets.find(pet => pet.id === editingId);
  const featured = animal || pets[0];
  useEffect(() => {
    const dialog = addDialog.current;
    if (!adding || !dialog) return;
    const trigger = addButton.current;
    const oldOverflow = document.body.style.overflow;
    dialog.showModal(); document.body.style.overflow = 'hidden';
    return () => { if (dialog.open) dialog.close(); document.body.style.overflow = oldOverflow; trigger?.focus({ preventScroll: true }); };
  }, [adding]);
  if (!user) return <Navigate to="/login" replace />;
  const changeTab = value => { setTab(value); setMessage(''); setError(''); };
  const savePet = async value => {
    if (busy) return;
    if (!value.name || !value.breed) { setError('กรุณากรอกชื่อและสายพันธุ์ให้ครบ'); return; }
    setBusy(true);
    let uploaded;
    try {
      const { photo, ...fields } = value;
      if (photo) uploaded = await uploadPhoto(user.id, photo);
      const id = await persistPet(user.id, { ...fields, img: uploaded || fields.img });
      setEditingId(id); setAdding(false); setError(''); setMessage(adding ? `เพิ่ม ${value.name} ใน My pet แล้ว เลือกน้องในหน้าตรวจได้เลย` : 'บันทึกข้อมูล My pet แล้ว ใช้รูปและข้อมูลใหม่ในหน้าตรวจได้เลย');
    } catch (failure) { if (uploaded) await discardPhoto(uploaded).catch(() => {}); setError(failure.message || 'บันทึกข้อมูลสัตว์เลี้ยงไม่สำเร็จ กรุณาลองใหม่'); }
    finally { setBusy(false); }
  };
  const removePet = async () => {
    const pet = deleting;
    if (!pet || busy) return;
    setBusy(true); setDeleteError('');
    try {
      await deletePet(user.id, pet.id);
      await discardPhoto(pet.imageSource).catch(() => {});
      setEditingId(pets.find(item => item.id !== pet.id)?.id);
      setDeleting(null); setError(''); setMessage(`ลบ ${pet.name} ออกจาก My pet แล้ว`);
    } catch (failure) { setDeleteError(failure.message || 'ลบสัตว์เลี้ยงไม่สำเร็จ กรุณาลองใหม่'); }
    finally { setBusy(false); }
  };
  return <div className="settings-page">
    <header className="settings-heading"><div><span className="settings-eyebrow">YOUR LITTLE WORLD</span><h1>ตั้งค่าบัญชี</h1><p>พื้นที่ของคุณ และเพื่อนซี้คนโปรด</p></div><span className="settings-local-badge"><ShieldCheck size={15} />บัญชีของคุณ</span></header>
    <div className="settings-layout">
      <aside className="settings-sidebar">
        <div className="settings-greeting"><span className="settings-user-icon"><img src={profileAvatar(user.avatar)} alt="รูปโปรไฟล์ของคุณ" /></span><div><small>ยินดีต้อนรับกลับมา</small><strong>{user.name}</strong></div></div>
        {featured && <div className="settings-featured"><img src={featured.img} alt={featured.name} /><div><span>MY BEST FRIEND</span><strong>{featured.name}</strong><p>{featured.breed}</p></div><Bone className="settings-featured-bone" size={24} /></div>}
        <nav className="settings-nav" aria-label="หมวดตั้งค่าบัญชี"><button type="button" className={tab === 'account' ? 'active' : ''} aria-pressed={tab === 'account'} onClick={() => changeTab('account')}><UserRound size={18} />บัญชีของฉัน<ChevronRight size={16} /></button><button type="button" className={tab === 'pets' ? 'active' : ''} aria-pressed={tab === 'pets'} onClick={() => changeTab('pets')}><PawPrint size={18} />My pet<span>{pets.length}</span></button></nav>
        <p className="settings-storage-note">ข้อมูลบัญชีและสัตว์เลี้ยงซิงก์ข้ามอุปกรณ์เมื่อเข้าสู่ระบบ</p>
      </aside>
      <section className="settings-main" aria-label={tab === 'account' ? 'บัญชีของฉัน' : 'My pet'}>
        {message && <p role="status" className="settings-feedback"><Check size={18} />{message}</p>}
        {error && <p role="alert" className="settings-error">{error}</p>}
        {tab === 'account' ? <>
          <form className="settings-card settings-form" onSubmit={async event => {
            event.preventDefault();
            if (busy) return;
            const form = event.currentTarget;
            const values = new FormData(form);
            if (!String(values.get('name')).trim()) { setError('กรุณากรอกชื่อผู้ใช้'); return; }
            const email = String(values.get('email')).trim();
            const emailChanged = email !== user.email;
            setBusy(true);
            let uploaded;
            try {
              if (avatarPhoto) uploaded = await uploadPhoto(user.id, avatarPhoto);
              await updateAccount({ data: { name: String(values.get('name')).trim(), avatar: uploaded || avatar },
                ...(emailChanged ? { email } : {}) });
              if (uploaded) { setAvatar(uploaded); setAvatarPhoto(null); }
              setMessage(emailChanged ? 'บันทึกโปรไฟล์แล้ว กรุณาตรวจอีเมลเพื่อยืนยันการเปลี่ยนที่อยู่' : 'บันทึกโปรไฟล์แล้ว');
              setError('');
            } catch (failure) { if (uploaded) await discardPhoto(uploaded).catch(() => {}); setError(failure.message || 'บันทึกไม่สำเร็จ กรุณาลองใหม่'); }
            finally { setBusy(false); }
          }}><div className="settings-card-heading"><span><UserRound size={21} /></span><div><h2>ข้อมูลบัญชี</h2><p>ให้เราเรียกคุณในแบบที่คุณชอบ</p></div></div><PhotoPicker value={avatar} photo={avatarPhoto} onChange={setAvatarPhoto} onProcessingChange={setAvatarPreparing} disabled={busy} label="รูปโปรไฟล์บัญชี" /><fieldset disabled={busy} className="settings-profile-picker"><legend>เลือกรูปโปรไฟล์ของคุณ</legend><div>{PROFILE_AVATARS.map(item => <button type="button" key={item.src} aria-label={item.label} aria-pressed={isAvatarSelected(item.src)} className={isAvatarSelected(item.src) ? 'selected' : ''} onClick={() => { setAvatar(item.src); setAvatarPhoto(null); }}><img src={item.src} alt="" />{isAvatarSelected(item.src) && <span><Check size={13} /></span>}</button>)}</div><p>เลือกรูปแล้วกดบันทึกการเปลี่ยนแปลง</p></fieldset><div className="settings-fields"><label>ชื่อผู้ใช้<div className="settings-input-icon"><UserRound size={17} /><input name="name" required maxLength={60} autoComplete="nickname" defaultValue={user.name} /></div></label><label>อีเมล<div className="settings-input-icon"><Mail size={17} /><input name="email" type="email" required maxLength={254} autoComplete="email" defaultValue={user.email} /></div></label></div><button className="settings-save" type="submit" disabled={busy || avatarPreparing}><Save size={17} />บันทึกการเปลี่ยนแปลง</button></form>
          <form className="settings-card settings-form" onSubmit={async event => {
            event.preventDefault();
            if (busy) return;
            const form = event.currentTarget;
            const values = new FormData(form);
            if (values.get('password') !== values.get('confirm')) { setPasswordMessage('รหัสผ่านทั้งสองช่องไม่ตรงกัน'); return; }
            setBusy(true);
            try {
              await updateAccount({ password: values.get('password') });
              setPasswordMessage('เปลี่ยนรหัสผ่านสำเร็จ');
              form.reset();
            } catch (failure) { setPasswordMessage(failure.message || 'เปลี่ยนรหัสผ่านไม่สำเร็จ'); }
            finally { setBusy(false); }
          }}><div className="settings-card-heading"><span><LockKeyhole size={21} /></span><div><h2>รหัสผ่าน</h2><p>ส่วนตั้งค่ารหัสผ่านสำหรับระบบบัญชี</p></div></div><p className="settings-password-note">{recovery ? "กรอกรหัสผ่านใหม่เพื่อกู้คืนบัญชี" : "ตั้งรหัสผ่านใหม่อย่างน้อย 8 ตัวอักษร"}</p><div className="settings-fields"><label>รหัสผ่านใหม่<input name="password" type="password" minLength={8} required autoComplete="new-password" placeholder="อย่างน้อย 8 ตัวอักษร" /></label><label>ยืนยันรหัสผ่านใหม่<input name="confirm" type="password" minLength={8} required autoComplete="new-password" placeholder="กรอกรหัสผ่านอีกครั้ง" /></label></div><p className="settings-password-message" role="status">{passwordMessage}</p><button className="settings-save secondary" type="submit" disabled={busy}><LockKeyhole size={16} />เปลี่ยนรหัสผ่าน</button></form>
        </> : <div className="settings-card"><div className="settings-pets-heading"><div><span className="settings-eyebrow">YOUR FURRY FAMILY</span><h2>My pet</h2><p>ทุกตัวคือสมาชิกคนสำคัญของบ้าน</p></div><button ref={addButton} type="button" className="settings-add" aria-haspopup="dialog" onClick={() => { setAdding(true); setMessage(''); setError(''); }}><Plus size={17} />เพิ่มสัตว์เลี้ยง</button></div><div className="settings-pet-list">{pets.map(pet => <button type="button" key={pet.id} className={editingId === pet.id ? 'active' : ''} aria-pressed={editingId === pet.id} onClick={() => { setEditingId(pet.id); setMessage(''); setError(''); }}><img src={pet.img} alt="" /><div><strong>{pet.name}</strong><small>{pet.breed} · {pet.age} ปี</small></div><Pencil size={16} /></button>)}</div>{loading && <p role="status">กำลังโหลดสัตว์เลี้ยง…</p>}{petError && <p role="alert">{petError}</p>}{animal && <PetEditor key={animal.id} animal={animal} busy={busy} onSave={savePet} />}{animal && <div className="settings-danger"><div><strong>ลบสัตว์เลี้ยง</strong><p>นำ {animal.name} ออกจาก My pet อย่างถาวร รวมถึงประวัติการตรวจและรูปที่อัปโหลด ต้องพิมพ์ชื่อน้องเพื่อยืนยันก่อน</p></div><button type="button" className="settings-delete" aria-haspopup="dialog" disabled={busy} onClick={() => { setDeleting(animal); setDeleteError(''); setMessage(''); setError(''); }}><Trash2 size={16} />ลบ {animal.name}</button></div>}</div>}
      </section>
    </div>
    {deleting && <DeletePetDialog key={deleting.id} pet={deleting} historyCount={history.filter(record => record.pet === deleting.id).length} busy={busy} error={deleteError} onCancel={() => { if (!busy) setDeleting(null); }} onConfirm={removePet} />}
    <dialog ref={addDialog} className="settings-pet-dialog" aria-labelledby="add-pet-title" onCancel={() => setAdding(false)}>
      <button type="button" className="settings-pet-dialog-close" onClick={() => setAdding(false)} aria-label="ปิดหน้าต่างเพิ่มสัตว์เลี้ยง"><X size={20} /></button>
      <div className="settings-add-pet-icon"><PawPrint size={27} /></div>
      <h2 id="add-pet-title">เพิ่มสมาชิกใหม่ใน My pet</h2>
      <p className="settings-add-pet-description">บันทึกข้อมูลน้องสุนัข เพื่อเลือกใช้ในการตรวจสุขภาพครั้งถัดไป</p>
      {adding && <PetEditor busy={busy} onSave={savePet} onCancel={() => setAdding(false)} />}
      {error && <p role="alert" className="settings-error">{error}</p>}
    </dialog>
  </div>;
}
