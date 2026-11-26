import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle, ArrowLeft, BarChart3, Check, ChevronLeft, ChevronRight, Info, MousePointerClick, PawPrint, RotateCw, ScanSearch, Stethoscope,
} from "lucide-react";
import Dropdown from "../../../shared/components/ui/Dropdown.jsx";
import { CHART_RANGES, formatShare, integerTicks, monthLong, monthShort, monthYearShort } from "../utils/health-chart.js";
import "../styles/HealthSummaryChart.css";

const petOptions = (pets) => [{ value: "", label: "ทุกตัว" }, ...pets.map((animal) => ({ value: animal.id, label: animal.name }))];

function PetPicker({ pets, pet, onPetChange }) {
  return (
    <label className="hchart-pet">
      <PawPrint size={16} aria-hidden="true" />
      <Dropdown value={pet} onChange={onPetChange} ariaLabel="เลือกสัตว์เลี้ยง" options={petOptions(pets)} />
    </label>
  );
}

/* ---------- Overview: monthly totals ---------- */
// Tapping or hovering a bar only shows that month's total; the "เพิ่มเติมรายเดือน" button under the month opens the detail view.
function Overview({ overview, months, lastMonth, onSelectMonth, hasHistory }) {
  const scrollRef = useRef(null);
  const [peek, setPeek] = useState(null);
  const ticks = integerTicks(Math.max(0, ...overview.map((bucket) => bucket.total)));
  const top = ticks[ticks.length - 1];
  const pct = (value) => (value / top) * 100;
  const rangeTotal = overview.reduce((sum, bucket) => sum + bucket.total, 0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = el.scrollWidth;
    // Returning from a month's detail: put keyboard focus back on that month's button.
    if (lastMonth) el.querySelector(`[data-key="${lastMonth}"]`)?.focus({ preventScroll: true });
  }, [months, lastMonth]);

  // Touch taps have no "leave" event: close the tooltip when tapping elsewhere.
  useEffect(() => {
    if (!peek) return undefined;
    const close = (event) => { if (!event.target.closest?.(".hchart-hit")) setPeek(null); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [peek]);

  if (!hasHistory) {
    return (
      <div className="hchart-empty">
        <span className="hchart-empty-icon" aria-hidden="true"><BarChart3 size={30} /></span>
        <h3>ยังไม่มีข้อมูลสำหรับแสดงกราฟ</h3>
        <p>ผลการตรวจจะแสดงที่นี่หลังจากตรวจสุขภาพครั้งแรก</p>
        <Link className="hchart-cta" to="/check"><PawPrint size={17} aria-hidden="true" />เริ่มตรวจสุขภาพ</Link>
      </div>
    );
  }

  return <div>
    <p className="hchart-total"><strong>{rangeTotal}</strong> ครั้ง <span>ใน {months} เดือนล่าสุด</span></p>
    <div className="hchart-plot" key={months}>
      <div className="hchart-yaxis" aria-hidden="true">
        <span className="hchart-yunit">ครั้ง</span>
        <div className="hchart-yticks">{ticks.map((tick) => <span key={tick} style={{ bottom: `${pct(tick)}%` }}>{tick}</span>)}</div>
      </div>
      <div className="hchart-scroll" ref={scrollRef}>
        <div className={`hchart-inner${months > 6 ? " dense" : ""}`} style={{ "--cols": months }}>
          <div className="hchart-gridlayer" aria-hidden="true">
            {ticks.map((tick) => <i key={tick} className="hchart-grid" style={{ bottom: `${pct(tick)}%` }} />)}
          </div>
          <ol className="hchart-cols">
            {overview.map((bucket, index) => {
              const open = peek === bucket.key;
              const edge = index < months / 3 ? " start" : index >= (months * 2) / 3 ? " end" : "";
              const summary = `${monthLong(bucket.key)} · ${bucket.total} ครั้ง`;
              return (
                <li key={bucket.key} className={`hchart-col${open ? " open" : ""}`} style={{ "--i": index }}>
                  <button type="button" className="hchart-hit" aria-label={summary} aria-expanded={open}
                    onPointerEnter={(event) => event.pointerType === "mouse" && setPeek(bucket.key)}
                    onPointerLeave={(event) => event.pointerType === "mouse" && setPeek((current) => (current === bucket.key ? null : current))}
                    onFocus={() => setPeek(bucket.key)}
                    onBlur={() => setPeek((current) => (current === bucket.key ? null : current))}
                    onClick={(event) => setPeek(event.detail === 0 && open ? null : bucket.key)}>
                    <span className="hchart-value" style={{ bottom: `${pct(bucket.total)}%` }}>{bucket.total}</span>
                    <span className={`hchart-bar${bucket.total ? "" : " zero"}`} style={{ height: `${pct(bucket.total)}%` }} />
                    {open && <span className={`hchart-tip${edge}`} role="tooltip" style={{ bottom: `calc(${pct(bucket.total)}% + 28px)` }}>{summary}</span>}
                  </button>
                  <div className="hchart-month">
                    <span className="hchart-month-name">{monthShort(bucket.key)}<small>{monthYearShort(bucket.key)}</small></span>
                    {bucket.total > 0 && <button type="button" className="hchart-more" data-key={bucket.key}
                      aria-label={`เพิ่มเติมรายเดือน ${monthLong(bucket.key)}`} title={`เพิ่มเติมรายเดือน ${monthLong(bucket.key)}`}
                      onClick={() => onSelectMonth(bucket.key)}>
                      <span className="hchart-more-full">เพิ่มเติมรายเดือน</span><span className="hchart-more-short">เพิ่มเติมรายเดือน</span>
                      <ChevronRight size={13} aria-hidden="true" />
                    </button>}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
    <p className="hchart-hint"><MousePointerClick size={15} aria-hidden="true" />แตะแท่งกราฟเพื่อดูจำนวนการตรวจ · กด “เพิ่มเติมรายเดือน” ใต้ชื่อเดือนที่มีประวัติเพื่อดูผลวิเคราะห์ของเดือนนั้น</p>
  </div>;
}

/* ---------- Detail: every day in the selected month ---------- */
function Detail({ month, monthChoices, onSelectMonth, onBack, detail, disease, onSelectDisease, petLabel }) {
  const backRef = useRef(null);
  const [peek, setPeek] = useState(null);
  const index = monthChoices.indexOf(month);
  const newestFirst = [...monthChoices].reverse().map((key) => ({ value: key, label: monthLong(key) }));
  const tooltipId = useId();
  const daily = detail.daily;
  const ticks = integerTicks(Math.max(0, ...daily.map((day) => day.total)));
  const top = ticks[ticks.length - 1];
  const pct = (value) => (value / top) * 100;
  const activeDay = daily.find((day) => day.key === peek);
  const daySummary = (day) => `วันที่ ${day.day} ${monthLong(month)} · ${day.total} ครั้ง${day.total ? ` · ${day.breakdown.map((item) => `${item.label} ${item.count} ครั้ง`).join(" · ")}` : " · ไม่มีการตรวจ"}`;

  useEffect(() => { backRef.current?.focus({ preventScroll: true }); }, []);

  return <>
    <div className="hdetail-nav">
      <button ref={backRef} type="button" className="hdetail-back" onClick={onBack}><ArrowLeft size={17} aria-hidden="true" />กลับภาพรวม</button>
      <div className="hdetail-month-picker">
        <button type="button" className="hdetail-step" aria-label="เดือนก่อนหน้า" disabled={index <= 0} onClick={() => onSelectMonth(monthChoices[index - 1])}><ChevronLeft size={17} /></button>
        <label className="hchart-pet hdetail-month"><Dropdown value={month} onChange={onSelectMonth} ariaLabel="เลือกเดือน" options={newestFirst} /></label>
        <button type="button" className="hdetail-step" aria-label="เดือนถัดไป" disabled={index >= monthChoices.length - 1} onClick={() => onSelectMonth(monthChoices[index + 1])}><ChevronRight size={17} /></button>
      </div>
    </div>

    <div className="hdetail-heading" key={month}>
      <h3>{monthLong(month)}</h3>
      <p>{petLabel}</p>
    </div>

    <ul className="hdetail-stats" key={`s-${month}`} aria-label="สรุปเดือนนี้">
      <li><span className="hdetail-stat-icon total" aria-hidden="true"><Stethoscope size={19} /></span><div><small>ตรวจทั้งหมด</small><strong>{detail.total} <em>ครั้ง</em></strong></div></li>
      <li><span className="hdetail-stat-icon normal" aria-hidden="true"><Check size={19} strokeWidth={2.6} /></span><div><small>ผลปกติ</small><strong>{detail.normal} <em>ครั้ง</em></strong></div></li>
      <li><span className="hdetail-stat-icon abnormal" aria-hidden="true"><ScanSearch size={19} /></span><div><small>พบความผิดปกติเบื้องต้น</small><strong>{detail.abnormal} <em>ครั้ง</em></strong></div></li>
    </ul>

    <section className="hdetail-breakdown hdaily" aria-labelledby="hdetail-breakdown-title">
      <div className="hdetail-breakdown-head">
        <h4 id="hdetail-breakdown-title">การตรวจรายวันตลอดเดือน</h4>
        <span>สีแทนประเภทผลวิเคราะห์ · วันที่ 1–{daily.length}</span>
      </div>
      <div className="hchart-plot hdaily-plot">
        <div className="hchart-yaxis" aria-hidden="true">
          <span className="hchart-yunit">ครั้ง</span>
          <div className="hchart-yticks">{ticks.map((tick) => <span key={tick} style={{ bottom: `${pct(tick)}%` }}>{tick}</span>)}</div>
        </div>
        <div className="hchart-scroll hdaily-scroll" tabIndex={0} role="region" aria-label={`กราฟรายวัน ${monthLong(month)} เลื่อนแนวนอนเพื่อดูทุกวัน`}>
          <div className="hchart-inner hdaily-inner" style={{ "--cols": daily.length }}>
            <div className="hchart-gridlayer" aria-hidden="true">{ticks.map((tick) => <i key={tick} className="hchart-grid" style={{ bottom: `${pct(tick)}%` }} />)}</div>
            <ol className="hchart-cols hdaily-cols">
              {daily.map((day) => {
                const open = day.key === peek;
                return <li className={`hchart-col${open ? " open" : ""}`} key={day.key}>
                  <button type="button" className="hchart-hit hdaily-hit" aria-label={daySummary(day)} aria-expanded={open} aria-describedby={open ? tooltipId : undefined}
                    onPointerEnter={(event) => event.pointerType === "mouse" && setPeek(day.key)}
                    onPointerLeave={(event) => event.pointerType === "mouse" && setPeek(null)}
                    onFocus={() => setPeek(day.key)} onBlur={() => setPeek(null)}
                    onKeyDown={(event) => event.key === "Escape" && setPeek(null)}
                    onClick={() => setPeek(day.key)}>
                    {day.total > 0 && <span className="hchart-value hdaily-value" style={{ bottom: `${pct(day.total)}%` }} aria-hidden="true">{day.total}</span>}
                    <span className={`hdaily-stack${day.total ? "" : " zero"}`} style={{ height: `${pct(day.total)}%` }} aria-hidden="true">
                      {detail.breakdown.map((category) => {
                        const segment = day.breakdown.find((entry) => entry.key === category.key);
                        return segment ? <span key={category.key} className={`hdaily-segment${disease && disease !== category.key ? " dim" : ""}`} style={{ height: `${segment.count / day.total * 100}%`, "--c": category.color }} /> : null;
                      })}
                    </span>
                  </button>
                  <span className="hdaily-day" aria-hidden="true">{day.day}</span>
                </li>;
              })}
            </ol>
          </div>
        </div>
      </div>
      <p className="hdaily-xunit">วันที่ในเดือน{monthLong(month)}</p>
      <div className="hdaily-inspect" aria-live="polite">
        {activeDay ? <div className="hdaily-tooltip" id={tooltipId} role="tooltip">
          <strong>วันที่ {activeDay.day} {monthLong(month)} · {activeDay.total} ครั้ง</strong>
          {activeDay.total ? <ul>{activeDay.breakdown.map((item) => <li key={item.key}><i style={{ background: item.color }} aria-hidden="true" />{item.label} <b>{item.count} ครั้ง</b></li>)}</ul> : <span>ไม่มีการตรวจในวันนี้</span>}
        </div> : <p><MousePointerClick size={15} aria-hidden="true" />ชี้ แตะ หรือใช้แป้นพิมพ์เลือกวัน เพื่อดูจำนวนและผลวิเคราะห์</p>}
      </div>
      {detail.total === 0 ? <p className="hdaily-empty">ไม่มีการตรวจในเดือนนี้ ลองเลือกเดือนอื่น หรือ <Link to="/check">เริ่มตรวจสุขภาพ</Link></p> : <>
        <p className="hdaily-legend-label">ประเภทผลวิเคราะห์ <span>กดเพื่อกรองรายการด้านล่าง</span></p>
        <ul className="hdaily-legend">
          {detail.breakdown.map((item) => <li key={item.key}>
            <button type="button" className={`${disease === item.key ? "selected" : ""}${disease && disease !== item.key ? " dim" : ""}`} style={{ "--c": item.color }} aria-pressed={disease === item.key}
              aria-label={`${item.label} ${item.count} ครั้ง ${formatShare(item.share)} ${disease === item.key ? "กดเพื่อยกเลิกตัวกรอง" : "กดเพื่อกรองรายการด้านล่าง"}`}
              onClick={() => onSelectDisease(disease === item.key ? "" : item.key)}>
              <i aria-hidden="true">{item.normal && <Check size={10} strokeWidth={3} />}</i>
              <span>{item.label}</span><b>{item.count} ครั้ง</b>
            </button>
          </li>)}
        </ul>
      </>}
    </section>
  </>;
}

/* ---------- Card shell: header, load states, view switch ---------- */
export default function HealthSummaryChart(props) {
  const { status, onRetry, pets, pet, onPetChange, months, onMonthsChange, month } = props;
  const titleId = useId();
  const petName = pets.find((entry) => entry.id === pet)?.name;
  const petLabel = petName ? `ของ${petName}` : "ของสัตว์เลี้ยงทุกตัว";

  return (
    <section className={`hchart${month ? " is-detail" : ""}`} aria-labelledby={titleId} aria-busy={status === "loading"}>
      <header className="hchart-head">
        <div className="hchart-title">
          <span className="hchart-title-icon" aria-hidden="true"><BarChart3 size={22} /></span>
          <div>
            <h2 id={titleId}>สรุปการตรวจสุขภาพ</h2>
            <p>{month ? `รายละเอียดรายเดือน ${petLabel}` : `จำนวนการตรวจรายเดือน ${petLabel}`}</p>
          </div>
        </div>
        {status === "ready" && (
          <div className="hchart-controls">
            <PetPicker pets={pets} pet={pet} onPetChange={onPetChange} />
            {!month && (
              <div className="hchart-range" role="group" aria-label="ช่วงเวลา">
                {CHART_RANGES.map((value) => (
                  <button key={value} type="button" aria-pressed={months === value} className={months === value ? "on" : ""} onClick={() => onMonthsChange(value)}>{value} เดือน</button>
                ))}
              </div>
            )}
          </div>
        )}
      </header>

      {status === "loading" && (
        <div className="hchart-loading" role="status">
          <div className="hchart-skeleton" aria-hidden="true">{[38, 62, 25, 80, 50, 68].map((height, index) => <i key={index} style={{ height: `${height}%`, "--i": index }} />)}</div>
          <span>กำลังโหลดข้อมูลกราฟ…</span>
        </div>
      )}

      {status === "error" && (
        <div className="hchart-empty error" role="alert">
          <span className="hchart-empty-icon" aria-hidden="true"><AlertCircle size={28} /></span>
          <h3>โหลดข้อมูลกราฟไม่สำเร็จ</h3>
          <p>ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต แล้วลองใหม่อีกครั้ง</p>
          <button type="button" className="hchart-cta" onClick={onRetry}><RotateCw size={16} aria-hidden="true" />ลองใหม่</button>
        </div>
      )}

      {status === "ready" && (
        <div className="hchart-view" key={month ? "detail" : "overview"}>
          {month ? <Detail key={month} {...props} petLabel={`ผลการตรวจ${petLabel}`} /> : <Overview {...props} />}
        </div>
      )}

      <p className="hchart-note"><Info size={14} aria-hidden="true" />กราฟนับจำนวนครั้งที่ระบบวิเคราะห์ภาพได้ผลแต่ละประเภท ไม่ใช่การยืนยันว่าเป็นโรค และไม่ได้บอกความรุนแรง ส่วนระดับความมั่นใจของแต่ละครั้งดูได้ในรายการด้านล่าง</p>
    </section>
  );
}
