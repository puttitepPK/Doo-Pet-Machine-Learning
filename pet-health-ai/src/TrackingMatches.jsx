import { useMemo, useState } from "react";
import { CalendarDays, ChevronDown, ChevronRight, Info, Link2, PawPrint, PlusCircle } from "lucide-react";
import Dropdown from "./Dropdown.jsx";
import { buildMatches, trackingDateLabel } from "./tracking-chart.js";
import { fmtDate } from "./shared.jsx";

const DAYS_PER_PAGE = 8;

// "พบร่วมกัน …" — says exactly how many of the selected pets share the result, never implies all of them.
function sharedText(petCount, petTotal) {
  if (petTotal === 2 && petCount === 2) return "พบในทั้ง 2 ตัว";
  if (petCount === petTotal) return `พบครบทั้ง ${petTotal} ตัว`;
  return `พบร่วมกัน ${petCount} จาก ${petTotal} ตัว`;
}

function PetCount({ pet }) {
  return (
    <li style={{ "--pet-color": pet.color }} className={pet.count ? "" : "none"}>
      <i aria-hidden="true" /><span>{pet.name}</span>
      <b>{pet.count ? `${pet.count} ครั้ง` : pet.checked ? "ไม่พบ" : "ไม่มีการตรวจ"}</b>
    </li>
  );
}

export default function TrackingMatches({ model, rangeLabel, available, onAddPet, onOpen, onDrill }) {
  const matches = useMemo(() => buildMatches(model.rows, model.series), [model.rows, model.series]);
  const [chosen, setChosen] = useState("");
  const [onlyMatched, setOnlyMatched] = useState(true);
  const [open, setOpen] = useState("");
  const [limit, setLimit] = useState(DAYS_PER_PAGE);
  const petTotal = matches.petTotal;
  const category = matches.categories.find((item) => item.key === chosen) ?? matches.shared[0] ?? matches.categories[0];
  const single = matches.categories.filter((item) => !item.shared);
  const filterMatched = onlyMatched && category?.sameDays > 0;
  const days = category ? category.days.filter((day) => !filterMatched || day.matched >= 2) : [];

  const choose = (key) => { setChosen(key); setOpen(""); setLimit(DAYS_PER_PAGE); setOnlyMatched(true); };
  const toggle = (day, pet) => {
    const id = `${day.day}/${pet.id}`;
    const next = open === id ? "" : id;
    setOpen(next);
    onDrill(next ? { pet: pet.id, result: category.key, start: day.day, end: day.day } : null);
  };

  if (petTotal < 2) {
    return (
      <div className="smatch-suggest">
        <span className="smatch-suggest-icon" aria-hidden="true"><PlusCircle size={26} /></span>
        <div>
          <h4>เพิ่มตัวเปรียบเทียบอย่างน้อย 1 ตัว</h4>
          <p>ตอนนี้เลือกสัตว์เลี้ยงเพียงตัวเดียว ผลที่ตรงกันต้องมีสัตว์เลี้ยงตั้งแต่ 2 ตัวขึ้นไปในช่วงเดียวกัน</p>
          {available.length
            ? <label className="strack-picker smatch-add"><span>เพิ่มตัวเปรียบเทียบ</span><Dropdown value="" onChange={(value) => value && onAddPet(value)} ariaLabel="เพิ่มสัตว์เลี้ยงเปรียบเทียบ" options={[{ value: "", label: "+ เลือกสัตว์เลี้ยง" }, ...available.map((pet) => ({ value: pet.id, label: pet.name }))]} /></label>
            : <p className="smatch-muted">บัญชีนี้มีสัตว์เลี้ยงตัวเดียว เพิ่มสัตว์เลี้ยงได้ที่หน้าตั้งค่าบัญชี</p>}
        </div>
      </div>
    );
  }
  if (!model.rows.length) return <p className="smatch-empty"><PawPrint size={20} aria-hidden="true" />ไม่มีการตรวจของสัตว์เลี้ยงที่เลือกในช่วง {rangeLabel}</p>;

  return (
    <div className="smatch">
      {/* Top: result types shared by two or more pets */}
      <p className="smatch-lead">
        <Link2 size={16} aria-hidden="true" />
        {matches.shared.length
          ? <>พบผลวิเคราะห์ประเภทเดียวกันในสัตว์เลี้ยงอย่างน้อย 2 ตัว <strong>{matches.shared.length} ประเภท</strong> (จาก {petTotal} ตัวที่เลือก)</>
          : <>ไม่พบผลวิเคราะห์ประเภทเดียวกันในสัตว์เลี้ยง {petTotal} ตัวที่เลือก ช่วง {rangeLabel}</>}
      </p>

      {matches.shared.length > 0 && (
        <ul className="smatch-cards">
          {matches.shared.map((item, index) => {
            const on = item.key === category?.key;
            return (
              <li key={item.key} style={{ "--i": index }}>
                <button type="button" className={`smatch-card${on ? " on" : ""}`} aria-pressed={on} onClick={() => choose(item.key)}>
                  <span className="smatch-card-head"><strong>{item.label}</strong><em>{sharedText(item.petCount, petTotal)}</em></span>
                  <ul className="smatch-pets">{item.pets.map((pet) => <PetCount key={pet.id} pet={pet} />)}</ul>
                  <span className="smatch-days">
                    <CalendarDays size={15} aria-hidden="true" />
                    {item.sameDays ? <>พบผลตรงกันในวันเดียวกัน <b>{item.sameDays} วัน</b></> : "ยังไม่พบผลตรงกันในวันเดียวกัน"}
                    {petTotal >= 3 && item.sameDays > 0 && <small>{item.allSameDays ? `ครบทั้ง ${petTotal} ตัว ${item.allSameDays} วัน` : `ไม่มีวันที่ตรงกันครบทั้ง ${petTotal} ตัว`}</small>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {single.length > 0 && (
        <div className="smatch-single">
          <span>{matches.shared.length ? "พบเพียงตัวเดียว:" : "ผลที่พบในช่วงนี้:"}</span>
          {single.map((item) => {
            const owner = item.pets.find((pet) => pet.count > 0);
            return (
              <button key={item.key} type="button" aria-pressed={item.key === category?.key} style={{ "--pet-color": owner.color }} onClick={() => choose(item.key)}>
                <i aria-hidden="true" />{item.label} · {owner.name} {owner.count} ครั้ง
              </button>
            );
          })}
        </div>
      )}

      {/* Bottom: one result type, day by day */}
      {category && (
        <section className="smatch-detail" aria-label={`รายละเอียดรายวัน ${category.label}`}>
          <div className="smatch-detail-head">
            <div>
              <h4>รายละเอียดแยกตามวัน</h4>
              <p>เรียงจากวันล่าสุด · วันที่ตามเวลาไทย</p>
            </div>
            <label className="strack-picker smatch-picker"><span>ประเภทผลวิเคราะห์</span>
              <Dropdown value={category.key} onChange={choose} ariaLabel="เลือกประเภทผลวิเคราะห์"
                options={matches.categories.map((item) => ({ value: item.key, label: `${item.label}${item.shared ? ` · ${item.petCount} ตัว` : ""}` }))} />
            </label>
          </div>
          <div className="strack-switch smatch-filter" role="group" aria-label="วันที่แสดง">
            <button type="button" aria-pressed={filterMatched} disabled={!category.sameDays} onClick={() => { setOnlyMatched(true); setLimit(DAYS_PER_PAGE); }}>เฉพาะวันที่ตรงกัน ({category.sameDays})</button>
            <button type="button" aria-pressed={!filterMatched} onClick={() => { setOnlyMatched(false); setLimit(DAYS_PER_PAGE); }}>ทุกวันที่พบผลนี้ ({category.days.length})</button>
          </div>

          <ol className="smatch-daylist">
            {days.slice(0, limit).map((day) => (
              <li key={day.day} className={day.matched >= 2 ? "matched" : ""}>
                <div className="smatch-day-head">
                  <strong>{trackingDateLabel(day.day)}</strong>
                  <span>{day.matched >= 2 ? `ตรงกัน ${day.matched} จาก ${petTotal} ตัว` : "พบ 1 ตัว"}</span>
                </div>
                <ul>
                  {day.pets.map((pet) => {
                    const id = `${day.day}/${pet.id}`;
                    const expanded = open === id;
                    return (
                      <li key={pet.id} style={{ "--pet-color": pet.color }}>
                        <span className="smatch-pet"><i aria-hidden="true" />{pet.name}</span>
                        {pet.count
                          ? <button type="button" className="smatch-count" aria-expanded={expanded} onClick={() => toggle(day, pet)}>
                              พบ {pet.count} ครั้ง{expanded ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronRight size={15} aria-hidden="true" />}
                            </button>
                          : pet.checked
                            ? <span className="smatch-status checked">ตรวจแล้ว {pet.checked} ครั้ง · ไม่พบผลประเภทนี้</span>
                            : <span className="smatch-status none">ไม่มีการตรวจ</span>}
                        {expanded && (
                          <ul className="smatch-records">
                            {pet.records.map((record) => (
                              <li key={record.id}>
                                <span>{fmtDate(record.date)}</span>
                                <button type="button" className="strack-open" onClick={(event) => onOpen(record, event)}>ดูรายละเอียดและรูป<ChevronRight size={15} aria-hidden="true" /></button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
          {days.length > limit && <button type="button" className="smatch-more" onClick={() => setLimit((value) => value + DAYS_PER_PAGE)}>แสดงวันเพิ่มเติม ({days.length - limit} วัน)</button>}
        </section>
      )}

      <p className="smatch-note"><Info size={15} aria-hidden="true" />ผลที่ตรงกันเป็นข้อมูลให้สังเกตเพิ่มเติมเท่านั้น ไม่ได้ยืนยันโรค สาเหตุ หรือการติดต่อระหว่างสัตว์เลี้ยง หากกังวลควรปรึกษาสัตวแพทย์</p>
    </div>
  );
}
