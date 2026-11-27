import { useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, AlertCircle, ArrowRight, ChevronLeft, ChevronRight, Info, Link2, PawPrint, RotateCw, X } from "lucide-react";
import Dropdown from "../../../shared/components/ui/Dropdown.jsx";
import { buildTracking, cardResultOrder, trackingKey as trackingKeyForRow, trackingLabel, trackingRecords, trackingText, trackingValue, trackingDateKey, trackingRange, trackingRangeLabel } from "../utils/tracking-chart.js";
import TrackingMatches from "./TrackingMatches.jsx";
import { Avatar } from "../../../shared/components/ui/Avatar.jsx";
import { fmtDate } from "../../../shared/utils/date.js";
import "../styles/SymptomTracking.css";

const PER_PAGE = 5;

function PetCards({ model, pets, unit, max, onSelect, selected }) {
  // Same order on every card so rows line up for comparison; zero-count types stay hidden per pet.
  const order = cardResultOrder(model.series, model.categories);
  const sharedCount = order.filter((item) => item.shared).length;
  return <>{sharedCount > 0 && model.series.length > 1 && <p className="strack-card-order"><span className="strack-shared-tag">พบร่วมกัน</span>ประเภทที่พบในสัตว์เลี้ยงตั้งแต่ 2 ตัวขึ้นไปอยู่ด้านบนของทุกการ์ด เรียงตามจำนวนครั้งรวม</p>}<div className="strack-pet-cards">{model.series.map((pet) => {
    const animal = pets.find((entry) => entry.id === pet.id);
    const results = order.filter((item) => pet.counts[item.key] > 0);
    return <article key={pet.id} className="strack-pet-card" style={{ "--pet-color": pet.color }}>
      <header><Avatar pet={animal} size={52} /><div><h4>{pet.name}</h4><p>ตรวจทั้งหมด <strong>{pet.total}</strong> ครั้ง</p></div></header>
      {pet.total ? <>
        <p className="strack-pet-status">ผลปกติ <b>{pet.normal}</b> · ผลอื่น / ผิดปกติเบื้องต้น <b>{pet.abnormal}</b></p>
        <p className="strack-card-scale">สเกลร่วม 0–{max}{unit === "share" ? "%" : " ครั้ง"}</p>
        <ul>{results.map(({ key: result, shared }) => {
          const value = trackingValue(pet.counts[result], pet.total, unit);
          const on = selected?.pet === pet.id && selected?.result === result;
          return <li key={result}><button type="button" className={`strack-card-bar${on ? " selected" : ""}`} aria-pressed={on} aria-label={`${pet.name} ${trackingLabel(result)}${shared ? " (พบร่วมกันในหลายตัว)" : ""} ${trackingText(value, unit)} กดเพื่อดูรายการ`} onClick={() => onSelect({ pet: pet.id, result })}>
            <span>{trackingLabel(result)}{shared && model.series.length > 1 && <em className="strack-shared-tag">พบร่วมกัน</em>}</span><b>{trackingText(value, unit)}</b><i className="strack-card-track" aria-hidden="true"><i style={{ width: `${value / max * 100}%`, background: pet.color }} /></i>
          </button></li>;
        })}</ul>
      </> : <div className="strack-card-empty"><PawPrint size={25} aria-hidden="true" /><p>ไม่มีการตรวจในช่วงวันที่เลือก</p><small>ยังสรุปผลสุขภาพจากช่วงนี้ไม่ได้</small></div>}
    </article>;
  })}</div></>;
}

export default function SymptomTracking({ records, pets, status, onRetry, onOpen }) {
  const helpDialog = useRef(null);
  const helpTitleId = useId();
  const [helpRead, setHelpRead] = useState(false);
  const titleId = useId();
  const [primary, setPrimary] = useState("");
  const [comparisons, setComparisons] = useState([]);
  const [rangePreset, setRangePreset] = useState("6m");
  const [customDates, setCustomDates] = useState({ start: "", end: "" });
  // Charts here summarise the whole range; month buckets only feed the per-pet model.
  const group = "month";
  const [mode, setMode] = useState("cards");
  const [unit, setUnit] = useState("count");
  const [drillState, setDrill] = useState(null);
  const [pageState, setPage] = useState({ scope: "", page: 1 });
  const primaryId = pets.some((pet) => pet.id === primary) ? primary : pets[0]?.id;
  const ids = primaryId ? [primaryId, ...comparisons.filter((id) => id !== primaryId && pets.some((pet) => pet.id === id)).slice(0, 2)] : [];
  const today = trackingDateKey(new Date());
  const range = useMemo(() => trackingRange(rangePreset, customDates, today), [rangePreset, customDates, today]);
  const idKey = ids.join("|");
  const model = useMemo(() => buildTracking(records, pets, idKey ? idKey.split("|") : [], range, group), [records, pets, idKey, range, group]);
  const scope = `${idKey}/${range.start}/${range.end}/${range.error}/${mode}`;
  const drill = drillState?.scope === scope ? drillState : null;
  const rows = useMemo(() => trackingRecords(model.rows, drill), [model.rows, drill]);
  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const page = Math.min(pageState.scope === `${scope}/${JSON.stringify(drill)}` ? pageState.page : 1, pages);
  const chooseDrill = (value) => setDrill({ ...value, scope });
  const changePage = (value) => setPage({ scope: `${scope}/${JSON.stringify(drill)}`, page: value });
  const max = unit === "share" ? 100 : Math.max(1, ...model.series.flatMap((pet) => Object.values(pet.counts)));
  const available = pets.filter((pet) => !ids.includes(pet.id));
  const selectedPet = model.series.find((pet) => pet.id === drill?.pet);
  const synthetic = model.rows.some((record) => record.care_advice?.synthetic);

  return <section className="strack" aria-labelledby={titleId} aria-busy={status === "loading"}>
    <header className="strack-header"><span className="strack-heading-icon" aria-hidden="true"><Activity size={25} /></span><div><span className="strack-eyebrow">ติดตามจากประวัติที่บันทึกไว้</span><h2 id={titleId}>ติดตามอาการของเพื่อนรัก</h2><p>ดูผลวิเคราะห์ของแต่ละตัว และผลตรวจที่ตรงกันในช่วงเดียวกัน</p></div>
      <button type="button" className={`strack-help-trigger${helpRead ? '' : ' is-unread'}`} aria-haspopup="dialog" onClick={() => { helpDialog.current?.showModal(); setHelpRead(true); }}><span className="strack-help-dot" aria-hidden="true" /><Info size={17} aria-hidden="true" />เทียบแล้วช่วยอะไร?</button>
    </header>
    <dialog ref={helpDialog} className="strack-help-dialog" aria-labelledby={helpTitleId} onClick={event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) helpDialog.current?.close();
    }}>
      <button type="button" className="strack-help-close" autoFocus aria-label="ปิดคำอธิบาย" onClick={() => helpDialog.current?.close()}><X size={21} /></button>
      <span className="strack-help-icon" aria-hidden="true"><PawPrint size={28} /></span>
      <h2 id={helpTitleId}>เทียบแล้วช่วยอะไร?</h2>
      <p>กราฟนี้ช่วยให้เราเทียบผลการตรวจที่เจอซ้ำเหมือนกัน ของสัตว์เลี้ยง</p>
      <div className="strack-help-example"><strong>ลองนึกถึง Buddy และ Demo</strong><p>หากน้องทั้งสองมีผลตรวจเข้ากลุ่มอาการแพ้บ่อยในช่วงเดียวกัน ลองทบทวนว่า ช่วงนั้นใช้แชมพูตัวเดียวกัน เปลี่ยนอาหารพร้อมกัน หรือไปเล่นที่เดียวกันหรือไม่</p></div>
      <p>การเห็นรูปแบบนี้ช่วยให้รู้ว่าควรสังเกตและบันทึกอะไรเพิ่มเติม แล้วนำประวัติไปคุยกับสัตวแพทย์ได้ง่ายขึ้น</p>
      <p className="strack-help-limit"><Info size={18} aria-hidden="true" /><span><strong>กราฟช่วยชี้สิ่งที่ควรสังเกต</strong> แต่ยังบอกไม่ได้ว่าสิ่งไหนเป็นสาเหตุ หรือยืนยันว่าเป็นโรคแพ้จริง</span></p>
      <button type="button" className="strack-cta strack-help-confirm" onClick={() => helpDialog.current?.close()}>เข้าใจแล้ว</button>
    </dialog>
    {status === "loading" ? <p className="strack-state" role="status">กำลังโหลดข้อมูลติดตามอาการ…</p> : status === "error" ? <div className="strack-state" role="alert"><AlertCircle size={28} /><h3>โหลดข้อมูลไม่สำเร็จ</h3><button className="strack-cta" type="button" onClick={onRetry}><RotateCw size={16} />ลองใหม่</button></div> : !pets.length ? <div className="strack-state"><PawPrint size={32} /><h3>เพิ่มสัตว์เลี้ยงเพื่อเริ่มติดตาม</h3><p>เลือกสัตว์เลี้ยงและตรวจสุขภาพเพื่อบันทึกผลครั้งแรก</p><Link to="/check" className="strack-cta">เริ่มตรวจสุขภาพ<ArrowRight size={16} /></Link></div> : <>
      <div className="strack-controls">
        <label className="strack-picker"><span>สัตว์เลี้ยงหลัก</span><Dropdown value={primaryId} onChange={(value) => { setDrill(null); setPrimary(value); setComparisons((current) => current.filter((id) => id !== value)); }} options={pets.map((pet) => ({ value: pet.id, label: pet.name }))} ariaLabel="เลือกสัตว์เลี้ยงหลัก" /></label>
        {ids.length < 3 && available.length > 0 && <label className="strack-picker"><span>เพิ่มตัวเปรียบเทียบ (รวมสูงสุด 3 ตัว)</span><Dropdown value="" onChange={(value) => { if (value) { setDrill(null); setComparisons((current) => [...current.filter((id) => pets.some((pet) => pet.id === id) && id !== primaryId), value].slice(0, 2)); } }} options={[{ value: "", label: "+ เพิ่มสัตว์เลี้ยง" }, ...available.map((pet) => ({ value: pet.id, label: pet.name }))]} ariaLabel="เพิ่มสัตว์เลี้ยงเปรียบเทียบ" /></label>}

      </div>
      <section className="strack-range-controls" aria-label="เลือกช่วงข้อมูล">
        <label className="strack-picker"><span>ช่วงข้อมูล (ใช้ร่วมกันทุกกราฟและรายการ)</span><Dropdown value={rangePreset} onChange={(value) => { setDrill(null); setRangePreset(value); }} options={[{value:"7d",label:"7 วันล่าสุด"},{value:"month",label:"เดือนนี้"},{value:"3m",label:"3 เดือนล่าสุด"},{value:"6m",label:"6 เดือนล่าสุด"},{value:"custom",label:"เลือกวันที่"}]} ariaLabel="เลือกช่วงวันที่ติดตาม" /></label>
        {rangePreset === "custom" && <div className="strack-custom-dates"><label><span>ตั้งแต่วันที่</span><input type="date" value={customDates.start} max={today} aria-invalid={Boolean(range.error)} onChange={(event) => { setDrill(null); setCustomDates((current) => ({ ...current, start: event.target.value })); }} /></label><label><span>ถึงวันที่ (รวมวันสิ้นสุด)</span><input type="date" value={customDates.end} max={today} aria-invalid={Boolean(range.error)} onChange={(event) => { setDrill(null); setCustomDates((current) => ({ ...current, end: event.target.value })); }} /></label><small>เลือกได้สูงสุด 366 วัน รวมวันเริ่มต้นและสิ้นสุด</small></div>}
      </section>
      <p className="strack-range">ช่วงข้อมูล: {trackingRangeLabel(range)} · ตามเวลาไทย</p>
      {range.error ? <p className="strack-range-error" role="alert">{range.error}</p> : <>
      <ul className="strack-chips" aria-label="สัตว์เลี้ยงที่กำลังติดตาม">{model.series.map((pet, index) => <li key={pet.id} style={{ "--pet-color": pet.color }}><i aria-hidden="true" /><span>{pet.name}{index === 0 ? " · ตัวหลัก" : ""}</span>{index > 0 && <button type="button" aria-label={`นำ ${pet.name} ออกจากการเปรียบเทียบ`} onClick={() => { setDrill(null); setComparisons((current) => current.filter((id) => id !== pet.id)); }}><X size={13} /></button>}</li>)}</ul>

      {synthetic && <p className="strack-warning"><Info size={15} />ช่วงนี้มีข้อมูลตัวอย่างประกอบอยู่ ข้อมูลตัวอย่างไม่ใช่ผลตรวจจริง</p>}
      <div className="strack-chart-controls"><div className="strack-switch" role="group" aria-label="รูปแบบกราฟ"><button type="button" aria-pressed={mode === "cards"} onClick={() => { setDrill(null); setMode("cards"); }}><PawPrint size={16} />สรุปรายตัว</button><button type="button" aria-pressed={mode === "match"} onClick={() => { setDrill(null); setMode("match"); }}><Link2 size={16} />ผลตรวจที่ตรงกัน</button></div>{mode !== "match" && <div className="strack-switch" role="group" aria-label="หน่วยของกราฟ"><button type="button" aria-pressed={unit === "count"} onClick={() => setUnit("count")}>จำนวนครั้ง</button><button type="button" aria-pressed={unit === "share"} onClick={() => setUnit("share")}>ร้อยละ (%)</button></div>}</div>
      <section className="strack-chart" aria-label={mode === "cards" ? "สรุปผลรายตัว" : "ผลตรวจที่ตรงกันระหว่างสัตว์เลี้ยง"}>
        <h3>{mode === "cards" ? "ผลตรวจของแต่ละตัว" : "ผลตรวจที่ตรงกัน"}</h3>
        <p className="strack-chart-note">{mode === "match" ? "ประเภทผลวิเคราะห์ที่พบในสัตว์เลี้ยงตั้งแต่ 2 ตัวขึ้นไปในช่วงเดียวกัน · กดจำนวนครั้งเพื่อดูรายการตรวจของวันนั้น" : `${unit === "share" ? "ร้อยละคิดจากจำนวนตรวจทั้งหมดของสัตว์เลี้ยงตัวนั้นในช่วงที่เลือก" : "นับจำนวนครั้งจากผลวิเคราะห์ที่บันทึกไว้"} · กดแท่งเพื่อดูรายการ`}</p>
        {mode === "cards" ? <PetCards model={model} pets={pets} unit={unit} max={max} onSelect={chooseDrill} selected={drill} /> : <TrackingMatches key={idKey} model={model} rangeLabel={trackingRangeLabel(range)} available={available} onOpen={onOpen} onDrill={(value) => value ? chooseDrill(value) : setDrill(null)}
          onAddPet={(value) => { setDrill(null); setComparisons((current) => [...current.filter((id) => pets.some((pet) => pet.id === id) && id !== primaryId), value].slice(0, 2)); }} />}
      </section>
      <section className="strack-records" aria-labelledby={`${titleId}-records`}>
        <div className="strack-record-head"><div><h3 id={`${titleId}-records`}>รายการตรวจที่เกี่ยวข้อง</h3><p>{drill ? `${selectedPet?.name ?? ""} · ${trackingLabel(drill.result)} · ${trackingRangeLabel(drill.start ? drill : range)}` : `ทุกผลของสัตว์เลี้ยงที่เลือก · ${trackingRangeLabel(range)}`} · {rows.length} รายการ</p></div>{drill && <button type="button" className="strack-reset" onClick={() => setDrill(null)}><X size={14} />ล้างการเลือกกราฟ</button>}</div>
        {rows.length ? <><ul>{rows.slice((page - 1) * PER_PAGE, page * PER_PAGE).map((record) => <li key={record.id}><div><strong>{pets.find((pet) => pet.id === record.pet)?.name ?? "ไม่พบข้อมูลสัตว์เลี้ยง"}</strong><span>{trackingLabel(trackingKeyForRow(record))}</span><small>{fmtDate(record.date)}{record.care_advice?.synthetic ? " · ข้อมูลตัวอย่าง" : ""}</small></div><button type="button" className="strack-open" onClick={(event) => onOpen(record, event)}>ดูรายละเอียด<ChevronRight size={16} /></button></li>)}</ul>{pages > 1 && <nav className="strack-pages" aria-label="หน้ารายการตรวจติดตาม"><button type="button" disabled={page === 1} aria-label="หน้าก่อน" onClick={() => changePage(page - 1)}><ChevronLeft size={16} /></button><span>หน้า {page} / {pages}</span><button type="button" disabled={page === pages} aria-label="หน้าถัดไป" onClick={() => changePage(page + 1)}><ChevronRight size={16} /></button></nav>}</> : <div className="strack-state compact"><PawPrint size={25} /><p>{drill ? "ไม่พบรายการตรวจที่ตรงกับจุดหรือแท่งที่เลือก" : "ยังไม่มีการตรวจในช่วงนี้ ลองเปลี่ยนช่วงเวลาหรือสัตว์เลี้ยง"}</p><Link to="/check">เริ่มตรวจสุขภาพ</Link></div>}
      </section>
      <p className="strack-disclaimer"><Info size={15} />ข้อมูลแสดงผลวิเคราะห์ภาพเบื้องต้น ไม่ใช่การวินิจฉัยหรือคะแนนสุขภาพ ความมั่นใจของระบบไม่ใช่ความรุนแรงของอาการ หากน้องมีอาการผิดปกติ ควรปรึกษาสัตวแพทย์</p>
      </>}
    </>}
  </section>;
}
