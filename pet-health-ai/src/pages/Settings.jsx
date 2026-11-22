import PhotoPicker from "../PhotoPicker.jsx";
import { uploadPhoto, discardPhoto } from "../photo-storage.js";
import { PROFILE_AVATARS, profileAvatar } from "../profile-avatars.js";
import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { Bone, UserRound, Mail, LockKeyhole, PawPrint, Plus, Pencil, Check, ChevronRight, Save, ShieldCheck, X } from "lucide-react";
import { useAuth, updateAccount } from "../auth-session.js";
import { DEFAULT_PETS, savePet as persistPet, usePets } from "../pet-store.js";
import "./Settings.css";
import Dropdown from "../Dropdown.jsx";

function PetEditor({ animal, onSave, onCancel, busy }) {
  const [image, setImage] = useState(animal?.imageSource || animal?.img || DEFAULT_PETS[0].img);
  const [photo, setPhoto] = useState(null);
  const [photoPreparing, setPhotoPreparing] = useState(false);
  return <form className="settings-form" onSubmit={event => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    onSave({ id: animal?.id, name: String(values.get('name')).trim(), breed: String(values.get('breed')).trim(), age: Number(values.get('age')), sex: values.get('sex'), img: image, photo });
  }}>
    <div className="settings-form-title"><PawPrint size={20} /><h3>{animal ? `แก้ไขข้อมูล ${animal.name}` : 'เพิ่มเพื่อนซี้ตัวใหม่'}</h3></div>
    <PhotoPicker value={image} photo={photo} onChange={setPhoto} onProcessingChange={setPhotoPreparing} disabled={busy} label="รูปสัตว์เลี้ยง" />
    <fieldset disabled={busy} className="pet-avatar-picker"><legend>เลือกรูปแทนตัวน้อง</legend><div>{DEFAULT_PETS.map(pet => <button key={pet.id} type="button" aria-label={`เลือกรูป ${pet.name}`} aria-pressed={image === pet.img} className={image === pet.img ? 'selected' : ''} onClick={() => { setImage(pet.img); setPhoto(null); }}><img src={pet.img} alt="" />{image === pet.img && <Check size={14} />}</button>)}</div></fieldset>
    <div className="settings-fields"><label>ชื่อน้อง<input name="name" required maxLength={40} defaultValue={animal?.name} placeholder="เช่น Buddy" /></label><label>สายพันธุ์<input name="breed" required maxLength={70} defaultValue={animal?.breed} placeholder="เช่น Golden Retriever" /></label><label>อายุ (ปี)<input name="age" type="number" min="0" max="40" step="0.1" required defaultValue={animal?.age ?? 1} /></label><label>เพศ<Dropdown name="sex" defaultValue={animal?.sex || 'ผู้'} ariaLabel="เพศ" options={[{ value: 'ผู้', label: 'ผู้' }, { value: 'เมีย', label: 'เมีย' }, { value: 'ไม่ระบุ', label: 'ไม่ระบุ' }]} /></label></div>
    <div className="pet-editor-actions"><button className="settings-save" type="submit" disabled={busy || photoPreparing}><Save size={17} />{animal ? "บันทึกข้อมูลน้อง" : "เพิ่มสัตว์เลี้ยง"}</button>{onCancel && <button className="settings-save secondary" type="button" onClick={onCancel}>ยกเลิก</button>}</div>
  </form>;
}

export default function Settings() {
  const { user, recovery } = useAuth();
  const [avatar, setAvatar] = useState(() => profileAvatar(user?.avatarSource || user?.avatar));
  const [avatarPhoto, setAvatarPhoto] = useState(null);
  const [avatarPreparing, setAvatarPreparing] = useState(false);
  const { rows: pets, loading, error: petError } = usePets();
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
          }}><div className="settings-card-heading"><span><UserRound size={21} /></span><div><h2>ข้อมูลบัญชี</h2><p>ให้เราเรียกคุณในแบบที่คุณชอบ</p></div></div><PhotoPicker value={avatar} photo={avatarPhoto} onChange={setAvatarPhoto} onProcessingChange={setAvatarPreparing} disabled={busy} label="รูปโปรไฟล์บัญชี" /><fieldset disabled={busy} className="settings-profile-picker"><legend>เลือกรูปโปรไฟล์ของคุณ</legend><div>{PROFILE_AVATARS.map(item => <button type="button" key={item.src} aria-label={item.label} aria-pressed={avatar === item.src} className={avatar === item.src ? 'selected' : ''} onClick={() => { setAvatar(item.src); setAvatarPhoto(null); }}><img src={item.src} alt="" />{avatar === item.src && <span><Check size={13} /></span>}</button>)}</div><p>เลือกรูปแล้วกดบันทึกการเปลี่ยนแปลง</p></fieldset><div className="settings-fields"><label>ชื่อผู้ใช้<div className="settings-input-icon"><UserRound size={17} /><input name="name" required maxLength={60} autoComplete="nickname" defaultValue={user.name} /></div></label><label>อีเมล<div className="settings-input-icon"><Mail size={17} /><input name="email" type="email" required maxLength={254} autoComplete="email" defaultValue={user.email} /></div></label></div><button className="settings-save" type="submit" disabled={busy || avatarPreparing}><Save size={17} />บันทึกการเปลี่ยนแปลง</button></form>
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
        </> : <div className="settings-card"><div className="settings-pets-heading"><div><span className="settings-eyebrow">YOUR FURRY FAMILY</span><h2>My pet</h2><p>ทุกตัวคือสมาชิกคนสำคัญของบ้าน</p></div><button ref={addButton} type="button" className="settings-add" aria-haspopup="dialog" onClick={() => { setAdding(true); setMessage(''); setError(''); }}><Plus size={17} />เพิ่มสัตว์เลี้ยง</button></div><div className="settings-pet-list">{pets.map(pet => <button type="button" key={pet.id} className={editingId === pet.id ? 'active' : ''} aria-pressed={editingId === pet.id} onClick={() => { setEditingId(pet.id); setMessage(''); setError(''); }}><img src={pet.img} alt="" /><div><strong>{pet.name}</strong><small>{pet.breed} · {pet.age} ปี</small></div><Pencil size={16} /></button>)}</div>{loading && <p role="status">กำลังโหลดสัตว์เลี้ยง…</p>}{petError && <p role="alert">{petError}</p>}{animal && <PetEditor key={animal.id} animal={animal} busy={busy} onSave={savePet} />}</div>}
      </section>
    </div>
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
