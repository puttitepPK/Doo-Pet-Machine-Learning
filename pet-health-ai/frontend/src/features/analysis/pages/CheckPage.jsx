import AnalysisResult from '../components/AnalysisResult.jsx';
import { predict } from '../services/prediction-api.js';
import { confidenceLevel } from "../../../shared/utils/confidence.js";
import { loadCareAdvice } from "../services/care-advice.js";
import OwnerContextForm from "../components/OwnerContextForm.jsx";
import { emptyOwnerContext, normalizeOwnerContext } from "../utils/owner-context.js";
import { usePets } from "../../pets/hooks/usePets.js";
import { useAuth } from "../../auth/hooks/useAuth.js";
import { saveAnalysis } from "../../history/services/history-service.js";
import { useHistory } from "../../history/hooks/useHistory.js";
import { diseaseName } from "../../../shared/constants/disease-labels.js";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PawPrint, UploadCloud, ImagePlus, Camera, Check as CheckIcon, HeartPulse, ClipboardList, CalendarDays, ArrowRight, X, Sparkles, AlertCircle, Pencil, Bone } from "lucide-react";
import { fmtDate } from "../../../shared/utils/date.js";
import { Avatar } from "../../../shared/components/ui/Avatar.jsx";
import { Risk } from "../../../shared/components/ui/Risk.jsx";
import Dropdown from "../../../shared/components/ui/Dropdown.jsx";

function predictionRisk(top) {
  return confidenceLevel(top?.score);
}

export default function Check() {
  const { user } = useAuth();
  const { rows: PETS, loading: petsLoading, error: petsError } = usePets();
  const { rows: history } = useHistory();
  const [petId, setPetId] = useState("");
  const [file, setFile] = useState(null); const [preview, setPreview] = useState("");
  const [drag, setDrag] = useState(false); const [state, setState] = useState("idle");
  const [care, setCare] = useState(null);
  // Optional owner context: the form draft, and the snapshot taken when "เริ่มวิเคราะห์" was pressed.
  const [ownerForm, setOwnerForm] = useState(emptyOwnerContext);
  const [submitted, setSubmitted] = useState(null);
  const adviceRequest = useRef(0);
  const [result, setResult] = useState([]); const [err, setErr] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideSeen, setGuideSeen] = useState(() => {
    try { return localStorage.getItem('doo-pet-guide-seen') === '1'; }
    catch { return false; }
  });
  const guideDialog = useRef(null);
  const guideButton = useRef(null);
  const input = useRef(null);
  const resultHeading = useRef(null);
  const uploadHeading = useRef(null);
  const pet = PETS.find((item) => item.id === petId) || PETS[0];
  const latest = history.filter((item) => item.pet === pet?.id).at(-1);
  const top = result[0];
  const risk = predictionRisk(top);
  const stage = state === "done" ? 4 : state === "loading" ? 2 : 1;

  useEffect(() => {
    if (state === "done") {
      resultHeading.current?.focus({ preventScroll: true });
      resultHeading.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    }
  }, [state]);

  useEffect(() => {
    const dialog = guideDialog.current;
    if (!guideOpen) { if (dialog?.open) dialog.close(); return; }
    dialog.showModal();
    const trigger = guideButton.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
      trigger?.focus({ preventScroll: true });
    };
  }, [guideOpen]);

  const openGuide = () => {
    setGuideSeen(true);
    try { localStorage.setItem('doo-pet-guide-seen', '1'); } catch { /* Reading is still available without storage. */ }
    setGuideOpen(true);
  };

  const pick = (selected) => {
    if (!selected || state === "loading") return;
    if (!/^image\/(jpeg|png|webp)$/.test(selected.type)) { setErr("รองรับไฟล์ JPG, PNG หรือ WEBP เท่านั้น"); return; }
    if (selected.size > 10 * 1024 * 1024) { setErr("ไฟล์มีขนาดเกิน 10MB กรุณาเลือกไฟล์ใหม่"); return; }
    adviceRequest.current += 1;
    setErr(""); setFile(selected); setState("idle"); setResult([]);
    setPreview((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(selected); });
  };
  const clear = () => { adviceRequest.current += 1; if (preview) URL.revokeObjectURL(preview); setFile(null); setPreview(""); setState("idle"); setResult([]); setErr(""); };
  // A new check (or another pet) starts with an empty context so answers never carry over.
  const newCheck = () => { clear(); setOwnerForm(emptyOwnerContext()); setSubmitted(null); setCare(null); };
  const choosePet = (id) => { if (id !== pet?.id) { setOwnerForm(emptyOwnerContext()); setSubmitted(null); } setPetId(id); };
  const run = async () => {
    if (!file) return;
    let ownerContext;
    try { ownerContext = normalizeOwnerContext({ version: 1, ...ownerForm }); }
    catch (error) { setErr(error.message); return; }
    const request = ++adviceRequest.current;
    setSubmitted(ownerContext);
    setCare(null);
    setState("loading"); setErr("");
    try {
      const detailed = Boolean(user && pet);
      const response = await predict(file, detailed);
      const { predictions } = response;
      if (!predictions.length) throw new Error("โมเดลไม่ส่งผลการวิเคราะห์กลับมา");
      setResult(predictions);
      setState("done");
      const top = predictions[0];
      // The image result above is final; owner context only shapes the advice text.
      const advice = await loadCareAdvice(top.label, undefined, { score: top.score, ownerContext, adviceScope: user?.id ?? 'guest' });
      if (adviceRequest.current === request) setCare(advice);
      if (user && pet) {
        try {
          const saved = await saveAnalysis(user.id, pet.id, file, response, predictionRisk(top), advice, ownerContext);
          if (ownerContext && !saved.ownerContextSaved && adviceRequest.current === request) setErr("บันทึกผลตรวจแล้ว แต่ยังบันทึกข้อมูลประกอบไม่ได้ เพราะฐานข้อมูลยังไม่ได้อัปเดต");
        }
        catch { if (adviceRequest.current === request) setErr("วิเคราะห์ภาพสำเร็จ แต่บันทึกประวัติไม่สำเร็จ"); }
      }
    } catch (error) {
      setState("error");
      setErr(error.message || "วิเคราะห์ภาพไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง");
    }
  };

  return <div className="check-page">
    <section className="check-hero check-mascot-banner" aria-labelledby="check-banner-title">
      <img className="check-banner-image check-banner-default" src="/images/analysis/health-banner-dog-gang-clean.png" alt="" />
      <img className="check-banner-image check-banner-set-two" src="/images/analysis/check-banner-set-2.png" alt="ตรวจสุขภาพสัตว์เลี้ยง วิเคราะห์โรคผิวหนัง แผล และภาวะเสี่ยงของสุนัข ด้วย ML" />
      <div className="check-banner-paws" aria-hidden="true">
        {Array.from({ length: 22 }, (_, index) => <PawPrint key={index} className="check-banner-paw" style={{ '--paw-x': `${[5, 20, 38, 53, 62, 91, 8, 32, 57, 94, 14, 27, 44, 66, 86, 3, 22, 47, 60, 96, 35, 69][index]}%`, '--paw-y': `${[12, 18, 8, 24, 48, 16, 57, 44, 68, 74, 36, 7, 53, 13, 7, 79, 65, 31, 84, 42, 82, 61][index]}%`, '--paw-size': `${22 + index % 4 * 9}px`, '--paw-angle': `${index % 2 ? 24 : -25}deg`, '--paw-duration': `${8 + index % 4}s`, '--paw-delay': `${-index * 1.5}s` }} />)}
      </div>
      <div className="check-banner-copy">
        <h1 id="check-banner-title"><span className="banner-wordmark">Doo Pet</span> ตรวจสุขภาพสัตว์เลี้ยง <Bone className="banner-bone" size={36} aria-hidden="true" /></h1>
        <p>วิเคราะห์โรคผิวหนัง แผล และภาวะเสี่ยงของสุนัข <span>ด้วยระบบ ML</span></p>
      </div>
      <button ref={guideButton} type="button" className={`check-guide-trigger${guideSeen ? '' : ' is-unread'}`} onClick={openGuide} aria-haspopup="dialog" aria-controls="check-guide-dialog"><AlertCircle size={19} aria-hidden="true" /><span>คลิกเพื่อดูคำแนะนำ</span></button>
    </section>

    <ol className="check-progress">{["อัปโหลดรูป", "วิเคราะห์ผล", "แสดงผลลัพธ์", "คำแนะนำ"].map((label, index) => <li key={label} className={index + 1 <= stage ? "active" : ""}><span>{index + 1}</span><b>{label}</b><i /></li>)}</ol>

    <div className="check-layout">
      <section className="check-left">
        {state === "done" && top ? (
          <AnalysisResult resultHeading={resultHeading} preview={preview} pet={pet} file={file} top={top} risk={risk} submitted={submitted} care={care} err={err} result={result} onNewCheck={() => { newCheck(); requestAnimationFrame(() => uploadHeading.current?.focus()); }} />
        ) : <div className="upload-panel" aria-busy={state === "loading"}>
          <h2 ref={uploadHeading} tabIndex={-1}><Camera size={25} fill="currentColor" />อัปโหลดรูปภาพ</h2>
          <div className={`check-drop ${drag ? "dragging" : ""}`} role="button" aria-disabled={state === "loading"} tabIndex={state === "loading" ? -1 : 0}
            onClick={() => { if (state !== "loading") input.current?.click(); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); if (state !== "loading") input.current?.click(); } }}
            onDragOver={(event) => { event.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={(event) => { event.preventDefault(); setDrag(false); pick(event.dataTransfer.files[0]); }}>
            {preview ? <><img className="check-preview-image" src={preview} alt="ภาพที่เลือกสำหรับตรวจสุขภาพ" /><button className="check-clear" type="button" disabled={state === "loading"} onClick={(event) => { event.stopPropagation(); clear(); }} aria-label="ลบรูปภาพ"><X size={18} /></button></> : <>
              <PawPrint className="drop-paw drop-paw-a" size={42} fill="currentColor" /><PawPrint className="drop-paw drop-paw-b" size={34} fill="currentColor" />
              <UploadCloud className="drop-cloud" size={70} strokeWidth={1.7} />
              <strong>ลากและวางรูปภาพที่นี่ หรือคลิกเพื่อเลือกไฟล์</strong><span>รองรับไฟล์ JPG, PNG, WEBP ขนาดไม่เกิน 10MB</span>
              <i className="or-divider"><span>หรือ</span></i>
              <button type="button" className="choose-image" onClick={(event) => { event.stopPropagation(); input.current?.click(); }}><ImagePlus size={19} />เลือกไฟล์จากเครื่อง</button>
            </>}
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => pick(event.target.files?.[0])} />
          </div>
          <OwnerContextForm value={ownerForm} onChange={setOwnerForm} disabled={state === "loading"} />
          {err && <p className="check-error" role="alert"><AlertCircle size={17} />{err}</p>}
          <button type="button" className="check-run" disabled={!file || state === "loading"} onClick={run}>{state === "loading" ? <><Sparkles className="spin" size={18} />กำลังวิเคราะห์ภาพ...</> : <><Sparkles size={18} />เริ่มวิเคราะห์สุขภาพ</>}</button>
        </div>}
      </section>

      <aside className="check-sidebar">
        <section className="pet-info-card"><h2><PawPrint size={22} fill="currentColor" />ข้อมูลสัตว์เลี้ยงของคุณ</h2>{pet ? <div className="pet-info-content"><Avatar pet={pet} size={90} /><div className="pet-meta"><label>ชื่อ <span>:</span><Dropdown disabled={state === "loading" || state === "done"} value={pet.id} onChange={choosePet} ariaLabel="เลือกสัตว์เลี้ยง" chevron={false} options={PETS.map((item) => ({ value: item.id, label: item.name }))} /><Pencil size={14} /></label><p><span className="pet-meta-icon">⌂</span>พันธุ์ : {pet.breed}</p><p><CalendarDays size={17} />อายุ : {pet.age} ปี</p></div></div> : <p>{petsLoading ? "กำลังโหลดสัตว์เลี้ยง…" : petsError || (user ? <Link to="/settings">เพิ่มสัตว์เลี้ยงเพื่อเก็บประวัติการตรวจ</Link> : <Link to="/login">เข้าสู่ระบบเพื่อเก็บประวัติการตรวจ</Link>)}</p>}</section>
        <section className="latest-card"><div className="latest-heading"><h2><ClipboardList size={22} />ประวัติการตรวจล่าสุด</h2><Link to="/history">ดูทั้งหมด <ArrowRight size={16} /></Link></div>{latest && pet ? <Link className="latest-entry" to="/history"><img src={pet.img} alt={pet.name} /><div><small><CalendarDays size={13} />{fmtDate(latest.date).split(" เวลา")[0]}</small><strong>กลุ่มโรค : {diseaseName(latest.disease)}</strong></div><Risk level={latest.risk} /></Link> : <p>ยังไม่มีประวัติการตรวจ</p>}</section>
        <section className="check-tips" aria-labelledby="check-tips-heading">
          <div className="tip-copy">
            <h3 id="check-tips-heading"><HeartPulse size={20} fill="currentColor" />คำแนะนำ</h3>
            <p className="tip-dog-only"><AlertCircle size={18} /><strong>ระบบรองรับสุนัขเท่านั้น กรุณาแนบรูปสุนัข ไม่ควรใช้รูปคนหรือสัตว์ชนิดอื่น</strong></p>
            <p><CheckIcon />ควรเป็นรูปบริเวณที่เห็นอาการชัดเจน</p>
            <p><CheckIcon />ถ่ายในที่สว่างและภาพคมชัด เพื่อผลลัพธ์ที่แม่นยำยิ่งขึ้น</p>
          </div>
        </section>
      </aside>
    </div>
    <dialog ref={guideDialog} id="check-guide-dialog" className="check-guide-dialog" aria-labelledby="check-guide-title" aria-describedby="check-guide-description" onCancel={() => setGuideOpen(false)} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setGuideOpen(false); } }}>
      <button type="button" className="check-guide-close" aria-label="ปิดคำแนะนำ" onClick={() => setGuideOpen(false)}><X size={21} /></button>
      <div className="check-guide-icon"><AlertCircle size={29} /></div>
      <span className="check-guide-eyebrow">ก่อนเริ่มใช้งาน DOO PET</span>
      <h2 id="check-guide-title">รู้จักระบบก่อนตรวจให้น้อง</h2>
      <p id="check-guide-description" className="check-guide-intro">ผู้ช่วยคัดกรองจากรูปภาพ เพื่อให้คุณดูแลสุนัขได้อย่างเข้าใจมากขึ้น</p>
      <div className="check-guide-highlight"><strong>เป็นการคัดกรองเบื้องต้นเท่านั้น</strong><p>ผลจาก Machine Learning เป็นเพียงการตรวจสอบเบื้องต้นเท่านั้น ไม่ใช่การวินิจฉัยโรค และไม่สามารถใช้แทนการตรวจจากสัตวแพทย์ได้</p></div>
      <ul className="check-guide-list">
        <li><PawPrint size={21} /><div><strong>รองรับรูปสุนัขเท่านั้น</strong><p>แนบรูปสุนัขของคุณ ไม่ใช้รูปคน สัตว์ชนิดอื่น หรือภาพการ์ตูน</p></div></li>
        <li><Camera size={21} /><div><strong>ภาพชัด ช่วยให้ประเมินได้ดีขึ้น</strong><p>ถ่ายบริเวณผิวหนังหรือแผลให้เห็นชัด ในที่สว่าง ไม่เบลอ ไม่ใส่ฟิลเตอร์ รองรับ JPG, PNG และ WEBP ไม่เกิน 10MB</p></div></li>
        <li><ClipboardList size={21} /><div><strong>ขอบเขตการตรวจของระบบ</strong><p>ระบบไม่ได้ตรวจได้ทุกโรค เน้นความผิดปกติที่สังเกตได้จากภาพ โดยเฉพาะโรคทางผิวหนังเป็นหลัก และจำกัดเฉพาะกลุ่มที่โมเดลเรียนรู้ คะแนนเปอร์เซ็นต์เป็นคะแนนที่โมเดลประเมิน ไม่ใช่ระดับความรุนแรงหรือการยืนยันว่าเป็นโรคนั้น</p></div></li>
        <li><HeartPulse size={21} /><div><strong>ดูผลควบคู่กับอาการจริงเสมอ</strong><p>หากมีอาการผิดปกติหรืออาการแย่ลง ควรปรึกษาสัตวแพทย์ แม้ระบบจะแสดงผลว่าผิวหนังปกติ</p></div></li>
      </ul>
      <button type="button" className="check-guide-confirm" onClick={() => setGuideOpen(false)}><CheckIcon size={18} />เข้าใจแล้ว เริ่มดูแลน้องกัน</button>
    </dialog>
  </div>;
}

