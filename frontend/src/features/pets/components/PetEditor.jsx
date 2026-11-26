import { useState } from 'react';
import { PawPrint, Check, Save } from 'lucide-react';
import PhotoPicker from '../../../shared/components/ui/PhotoPicker.jsx';
import Dropdown from '../../../shared/components/ui/Dropdown.jsx';
import { DEFAULT_PETS } from '../constants/default-pets.js';
export default function PetEditor({ animal, onSave, onCancel, busy }) {
  const [image, setImage] = useState(animal?.imageSource || animal?.img || DEFAULT_PETS[0].img);
  const [photo, setPhoto] = useState(null);
  const [photoPreparing, setPhotoPreparing] = useState(false);
  // Existing rows may still reference the original static URL.
  const isSelected = source => image === source || image === source.replace('/images/pets/', '/dogs/');
  return <form className="settings-form" onSubmit={event => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    onSave({ id: animal?.id, name: String(values.get('name')).trim(), breed: String(values.get('breed')).trim(), age: Number(values.get('age')), sex: values.get('sex'), img: image, photo });
  }}>
    <div className="settings-form-title"><PawPrint size={20} /><h3>{animal ? `แก้ไขข้อมูล ${animal.name}` : 'เพิ่มเพื่อนซี้ตัวใหม่'}</h3></div>
    <PhotoPicker value={image} photo={photo} onChange={setPhoto} onProcessingChange={setPhotoPreparing} disabled={busy} label="รูปสัตว์เลี้ยง" />
    <fieldset disabled={busy} className="pet-avatar-picker"><legend>เลือกรูปแทนตัวน้อง</legend><div>{DEFAULT_PETS.map(pet => <button key={pet.id} type="button" aria-label={`เลือกรูป ${pet.name}`} aria-pressed={isSelected(pet.img)} className={isSelected(pet.img) ? 'selected' : ''} onClick={() => { setImage(pet.img); setPhoto(null); }}><img src={pet.img} alt="" />{isSelected(pet.img) && <Check size={14} />}</button>)}</div></fieldset>
    <div className="settings-fields"><label>ชื่อน้อง<input name="name" required maxLength={40} defaultValue={animal?.name} placeholder="เช่น Buddy" /></label><label>สายพันธุ์<input name="breed" required maxLength={70} defaultValue={animal?.breed} placeholder="เช่น Golden Retriever" /></label><label>อายุ (ปี)<input name="age" type="number" min="0" max="40" step="0.1" required defaultValue={animal?.age ?? 1} /></label><label>เพศ<Dropdown name="sex" defaultValue={animal?.sex || 'ผู้'} ariaLabel="เพศ" options={[{ value: 'ผู้', label: 'ผู้' }, { value: 'เมีย', label: 'เมีย' }, { value: 'ไม่ระบุ', label: 'ไม่ระบุ' }]} /></label></div>
    <div className="pet-editor-actions"><button className="settings-save" type="submit" disabled={busy || photoPreparing}><Save size={17} />{animal ? "บันทึกข้อมูลน้อง" : "เพิ่มสัตว์เลี้ยง"}</button>{onCancel && <button className="settings-save secondary" type="button" onClick={onCancel}>ยกเลิก</button>}</div>
  </form>;
}

