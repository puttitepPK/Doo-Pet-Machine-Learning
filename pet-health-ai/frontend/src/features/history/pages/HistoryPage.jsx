import ResultBadge from '../components/ResultBadge.jsx';
import HistoryPhoto from "../components/HistoryPhoto.jsx";
import { usePets } from "../../pets/hooks/usePets.js";
import { useAuth } from "../../auth/hooks/useAuth.js";
import { useHistory } from "../hooks/useHistory.js";
import CareAdvice from "../../analysis/components/CareAdvice.jsx";
import OwnerContextSummary from "../../analysis/components/OwnerContextSummary.jsx";
import HealthSummaryChart from "../components/HealthSummaryChart.jsx";
import SymptomTracking from "../components/SymptomTracking.jsx";
import {
  buildDailyCounts, buildDiseaseBreakdown, buildMonthlyCounts, currentMonthKey, diseaseColor, diseaseKey, isNormal,
  monthLong, monthRange, monthsBetween, recordMonthKey,
} from "../utils/health-chart.js";
import { diseaseName } from "../../../shared/constants/disease-labels.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { createPortal } from "react-dom";
import {
  Activity, AlertTriangle, BarChart3, CalendarDays, ChevronLeft, ChevronRight, ClipboardCheck, ListChecks,
  Clock3, Filter, PawPrint, RotateCcw, Search, ShieldCheck, Stethoscope, X,
} from "lucide-react";
import { fmtDate } from "../../../shared/utils/date.js";
import { Avatar } from "../../../shared/components/ui/Avatar.jsx";
import Dropdown from "../../../shared/components/ui/Dropdown.jsx";

const UNKNOWN_PET = { name: "ไม่พบข้อมูลสัตว์เลี้ยง", breed: "-", age: "-", img: "/favicon.svg" };

export default function History() {
  const { user } = useAuth();
  const { rows: PETS, loading: petsLoading, error: petsError } = usePets();
  const { rows: HISTORY, loading, error } = useHistory();
  const [query, setQuery] = useState("");
  const [pet, setPet] = useState("");
  const [risk, setRisk] = useState("");
  const [sort, setSort] = useState("new");
  const [months, setMonths] = useState(6);
  const [month, setMonth] = useState("");
  const [lastMonth, setLastMonth] = useState("");
  const [disease, setDisease] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState("chart");
  const openerRef = useRef(null);
  const modalRef = useRef(null);
  const closeRef = useRef(null);
  const perPage = 5;

  // One shared scope drives the summary cards, the chart and the list:
  // overview = selected pet within the chosen range; detail = selected pet within the chosen month (Asia/Bangkok).
  const thisMonth = currentMonthKey();
  const rangeKeys = useMemo(() => monthRange(thisMonth, months), [thisMonth, months]);
  const petRows = useMemo(() => (pet ? HISTORY.filter((item) => item.pet === pet) : HISTORY), [HISTORY, pet]);
  const overview = useMemo(() => buildMonthlyCounts(petRows, rangeKeys), [petRows, rangeKeys]);
  const scopeRows = useMemo(() => {
    const keys = new Set(month ? [month] : rangeKeys);
    return petRows.filter((item) => keys.has(recordMonthKey(item)));
  }, [petRows, month, rangeKeys]);
  const detail = useMemo(() => {
    const normal = scopeRows.filter(isNormal).length;
    return { total: scopeRows.length, normal, abnormal: scopeRows.length - normal, breakdown: month ? buildDiseaseBreakdown(scopeRows) : [], daily: month ? buildDailyCounts(scopeRows, month) : [] };
  }, [scopeRows, month]);
  const monthChoices = useMemo(() => {
    const keys = HISTORY.map(recordMonthKey).filter(Boolean).sort();
    const first = keys[0] && keys[0] < rangeKeys[0] ? keys[0] : rangeKeys[0];
    return monthsBetween(month && month < first ? month : first, thisMonth);
  }, [HISTORY, rangeKeys, thisMonth, month]);

  const stats = useMemo(() => ({
    total: scopeRows.length,
    low: scopeRows.filter((item) => item.risk === "low").length,
    mid: scopeRows.filter((item) => item.risk === "mid").length,
    high: scopeRows.filter((item) => item.risk === "high").length,
  }), [scopeRows]);

  const records = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = scopeRows.filter((item) => {
      const animal = PETS.find((entry) => entry.id === item.pet);
      const matchesSearch = !needle || `${animal?.name ?? ""} ${animal?.breed ?? ""} ${item.disease} ${diseaseName(item.disease)}`.toLowerCase().includes(needle);
      return matchesSearch && (!risk || item.risk === risk) && (!month || !disease || diseaseKey(item) === disease);
    });
    return filtered.sort((a, b) => sort === "new"
      ? new Date(b.date) - new Date(a.date)
      : new Date(a.date) - new Date(b.date));
  }, [query, risk, month, disease, sort, PETS, scopeRows]);

  const pages = Math.max(1, Math.ceil(records.length / perPage));
  const currentPage = Math.min(page, pages);
  const visible = records.slice((currentPage - 1) * perPage, currentPage * perPage);

  // Every filter change starts the list again from page 1.
  const withReset = (setter) => (value) => { setter(value); setPage(1); };
  const setFilter = (setter) => (event) => { setter(event.target.value); setPage(1); };
  const changePet = (value) => { setPet(value); setDisease(""); setPage(1); };
  const changeMonths = (value) => { setMonths(value); setPage(1); };
  const openMonth = (key) => { setMonth(key); setLastMonth(key); setDisease(""); setPage(1); };
  const backToOverview = () => { setMonth(""); setDisease(""); setPage(1); };
  const clearFilters = () => { setQuery(""); setRisk(""); setDisease(""); setSort("new"); setPage(1); };
  const retry = () => { window.dispatchEvent(new Event("doo-pet-history")); window.dispatchEvent(new Event("doo-pet-pets")); };
  const closeDetails = () => setSelected(null);
  const openTrackingRecord = (record, event) => {
    openerRef.current = event.currentTarget;
    setSelected({ ...record, animal: PETS.find((animal) => animal.id === record.pet) ?? UNKNOWN_PET });
  };
  // Left tab rail: "กราฟ" shows the chart, "รายละเอียด" swaps it for the filtered history list.
  const VIEWS = ["chart", "details", "tracking"];
  const onTabKey = (event) => {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
    const target = event.key === "Home" ? 0 : event.key === "End" ? VIEWS.length - 1 : step ? (VIEWS.indexOf(view) + step + VIEWS.length) % VIEWS.length : null;
    if (target === null) return;
    event.preventDefault();
    setView(VIEWS[target]);
    document.getElementById(`history-tab-${VIEWS[target]}`)?.focus();
  };

  const petName = PETS.find((entry) => entry.id === pet)?.name;
  const scopeLabel = month ? `เดือน${monthLong(month)}` : `${months} เดือนล่าสุด`;
  const diseaseInfo = disease ? { label: diseaseKey({ disease }) === "unknown" ? "ไม่ระบุผลวิเคราะห์" : diseaseName(disease), color: diseaseColor(disease) } : null;
  const listOnlyFilters = Boolean(query.trim() || risk);
  const status = loading || petsLoading ? "loading" : error || petsError ? "error" : "ready";

  useEffect(() => {
    if (!selected) return undefined;
    const returnFocusTo = openerRef.current;
    // Keep the navbar visible above the dialog: lift it over the backdrop and leave room for it
    // (top bar on desktop, bottom tab bar on mobile).
    const root = document.documentElement;
    const placeNav = () => {
      const header = document.querySelector("header.top")?.getBoundingClientRect();
      const links = document.querySelector("header.top nav")?.getBoundingClientRect();
      const top = header && header.top < window.innerHeight / 2 ? Math.max(0, header.bottom) : 0;
      const bottom = links && links.top > window.innerHeight / 2 ? Math.max(0, window.innerHeight - links.top) : 0;
      root.style.setProperty("--doo-nav-top", `${Math.round(top)}px`);
      root.style.setProperty("--doo-nav-bottom", `${Math.round(bottom)}px`);
    };
    placeNav();
    document.body.classList.add("doo-modal-open");
    window.addEventListener("resize", placeNav);
    const frame = requestAnimationFrame(() => closeRef.current?.focus());
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDetails();
        return;
      }
      if (event.key !== "Tab" || !modalRef.current) return;
      const focusable = [...modalRef.current.querySelectorAll(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )];
      if (!focusable.length) {
        event.preventDefault();
        modalRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", placeNav);
      document.body.classList.remove("doo-modal-open");
      returnFocusTo?.focus();
    };
  }, [selected]);

  if (!user) return (
    <section className="history-login-prompt" aria-labelledby="history-login-title">
      <div className="history-login-icon" aria-hidden="true">
        <ClipboardCheck size={48} strokeWidth={1.6} />
        <span><PawPrint size={20} /></span>
      </div>
      <span className="history-login-eyebrow">ประวัติสุขภาพของเพื่อนรัก</span>
      <h1 id="history-login-title">ประวัติการตรวจสุขภาพ</h1>
      <p className="history-login-message">กรุณา <Link to="/login">เข้าสู่ระบบ</Link><br className="history-login-break" /> เพื่อดูประวัติการตรวจ</p>
      <p className="history-login-description">ติดตามผลการตรวจและดูแลสุขภาพน้องหมาของคุณได้ในที่เดียว</p>
      <Link className="history-login-button" to="/login">เข้าสู่ระบบ<ChevronRight size={21} aria-hidden="true" /></Link>
    </section>
  );
  return (
    <div className="history-page">
      <div className="history-background-paws" aria-hidden="true">
        {Array.from({ length: 22 }, (_, index) => <PawPrint key={index} style={{
          '--paw-x': `${(index * 37 + 4) % 96}%`,
          '--paw-y': `${(index * 29 + 3) % 96}%`,
          '--paw-size': `${26 + index % 5 * 9}px`,
          '--paw-angle': `${index % 2 ? 24 : -28}deg`,
        }} />)}
      </div>
      <section className="history-hero">
        <div className="history-hero-icon"><ClipboardCheck size={46} strokeWidth={1.8} /><PawPrint size={24} /></div>
        <div className="history-hero-copy">
          <span className="history-eyebrow">PET HEALTH RECORD</span>
          <h1>ประวัติการตรวจสุขภาพ</h1>
          <p>ติดตามผลการตรวจและประวัติสุขภาพสัตว์เลี้ยงของคุณ</p>
        </div>
        <PawPrint className="history-hero-paw" size={58} />
        <div className="history-hero-pets" aria-hidden="true">
          <img src="/images/pets/Buddy.png" alt="" />
          <img src="/images/pets/Luna.png" alt="" />
        </div>
        <span className="history-heart">♡</span>
      </section>

      <div className="history-workspace">
      {status === "ready" && view !== "tracking" && <section className="history-stats" aria-label={`สรุปประวัติการตรวจ ${scopeLabel}`}>
        <article className="history-stat total"><span className="history-stat-icon"><Stethoscope size={30} /></span><div><small>การตรวจทั้งหมด</small><strong>{stats.total} ครั้ง</strong><p>{scopeLabel}{petName ? ` · ${petName}` : ""}</p></div></article>
        <article className="history-stat low"><span className="history-stat-icon"><ShieldCheck size={30} /></span><div><small>ความมั่นใจต่ำ</small><strong>{stats.low} ครั้ง</strong><p>ผลวิเคราะห์ที่มีความมั่นใจต่ำ</p></div></article>
        <article className="history-stat mid"><span className="history-stat-icon"><AlertTriangle size={30} /></span><div><small>ความมั่นใจกลาง</small><strong>{stats.mid} ครั้ง</strong><p>ผลวิเคราะห์ที่มีความมั่นใจกลาง</p></div></article>
        <article className="history-stat high"><span className="history-stat-icon"><AlertTriangle size={30} /></span><div><small>ความมั่นใจสูง</small><strong>{stats.high} ครั้ง</strong><p>ผลวิเคราะห์ที่มีความมั่นใจสูง</p></div></article>
      </section>}

      <nav className="history-tabs" role="tablist" aria-label="มุมมองประวัติการตรวจ" aria-orientation="vertical" onKeyDown={onTabKey}>
        <button type="button" id="history-tab-chart" role="tab" aria-selected={view === "chart"} aria-controls="history-panel" tabIndex={view === "chart" ? 0 : -1}
          className={view === "chart" ? "on" : ""} onClick={() => setView("chart")}>
          <span className="history-tab-icon" aria-hidden="true"><BarChart3 size={20} /></span>
          <span className="history-tab-text"><b>กราฟ</b><small>{month ? `เดือน${monthLong(month)}` : `สรุป ${months} เดือนล่าสุด`}</small></span>
        </button>
        <button type="button" id="history-tab-details" role="tab" aria-selected={view === "details"} aria-controls="history-panel" tabIndex={view === "details" ? 0 : -1}
          className={view === "details" ? "on" : ""} onClick={() => setView("details")}>
          <span className="history-tab-icon" aria-hidden="true"><ListChecks size={20} /></span>
          <span className="history-tab-text"><b>รายละเอียด</b><small>{status === "ready" ? `${records.length} รายการ` : "รายการประวัติ"}</small></span>
        </button>
        <button type="button" id="history-tab-tracking" role="tab" aria-selected={view === "tracking"} aria-controls="history-panel" tabIndex={view === "tracking" ? 0 : -1}
          className={view === "tracking" ? "on" : ""} onClick={() => setView("tracking")}>
          <span className="history-tab-icon" aria-hidden="true"><Activity size={20} /></span>
          <span className="history-tab-text"><b>ติดตามอาการ</b><small>เปรียบเทียบและดูแนวโน้ม</small></span>
        </button>
      </nav>

      <div id="history-panel" className="history-panel" role="tabpanel" aria-labelledby={`history-tab-${view}`}>
      <div hidden={view !== "tracking"}>
        <SymptomTracking records={HISTORY} pets={PETS} status={status} onRetry={retry} onOpen={openTrackingRecord} />
      </div>
      {view === "chart" && <>
      <HealthSummaryChart status={status} onRetry={retry}
        pets={PETS} pet={pet} onPetChange={changePet}
        months={months} onMonthsChange={changeMonths}
        overview={overview} hasHistory={petRows.length > 0}
        month={month} lastMonth={lastMonth} monthChoices={monthChoices} onSelectMonth={openMonth} onBack={backToOverview}
        detail={detail} disease={disease} onSelectDisease={withReset(setDisease)} />
      {status === "ready" && <button type="button" className="history-to-details" onClick={() => setView("details")}>
        <ListChecks size={18} aria-hidden="true" />
        <span>ดูรายการประวัติ <strong>{records.length} รายการ</strong> · {scopeLabel} · {petName ?? "ทุกตัว"}{diseaseInfo ? ` · ${diseaseInfo.label}` : ""}</span>
        <ChevronRight size={17} aria-hidden="true" />
      </button>}
      </>}

      {view === "details" && status === "ready" && <>
        <section className="history-toolbar" aria-label="ตัวกรองประวัติ">
          <label className="history-search"><Search size={19} /><input value={query} onChange={setFilter(setQuery)} placeholder="ค้นหาชื่อสัตว์เลี้ยง หรือผลการตรวจ..." aria-label="ค้นหาในรายการ" /></label>
          <label className="history-select"><PawPrint size={18} /><Dropdown value={pet} onChange={changePet} ariaLabel="กรองตามสัตว์เลี้ยง" options={[{ value: "", label: "ทุกสัตว์เลี้ยง" }, ...PETS.map((animal) => ({ value: animal.id, label: animal.name }))]} /></label>
          <label className="history-select"><ShieldCheck size={18} /><Dropdown value={risk} onChange={withReset(setRisk)} ariaLabel="กรองตามระดับความมั่นใจ" options={[{ value: "", label: "ทุกระดับความมั่นใจ" }, { value: "low", label: "ความมั่นใจต่ำ" }, { value: "mid", label: "ความมั่นใจกลาง" }, { value: "high", label: "ความมั่นใจสูง" }]} /></label>
          <label className="history-select date"><CalendarDays size={18} /><Dropdown value={sort} onChange={withReset(setSort)} ariaLabel="เรียงลำดับ" options={[{ value: "new", label: "เรียงตามวันที่ (ล่าสุดก่อน)" }, { value: "old", label: "เรียงตามวันที่ (เก่าสุดก่อน)" }]} /></label>
          <button className="history-reset" onClick={clearFilters}><RotateCcw size={17} />ล้างตัวกรอง</button>
        </section>

        <div className="history-scope" role="status">
          <Filter size={17} aria-hidden="true" />
          <span className="history-scope-text">
            แสดง <strong>{records.length} รายการ</strong> · {scopeLabel} · {petName ?? "ทุกตัว"}
            {diseaseInfo && <> · ผล <span className="history-scope-chip" style={{ "--c": diseaseInfo.color }}><i aria-hidden="true" />{diseaseInfo.label}</span></>}
            {listOnlyFilters && <span className="history-scope-note">การค้นหาและตัวกรองระดับความมั่นใจมีผลเฉพาะรายการด้านล่าง ตัวเลขสรุปและกราฟยังนับทั้ง{scopeLabel}</span>}
          </span>
          {disease && <button type="button" onClick={() => withReset(setDisease)("")}><X size={15} aria-hidden="true" />แสดงผลทั้งหมดของเดือน</button>}
          {month && <button type="button" onClick={backToOverview}><RotateCcw size={15} aria-hidden="true" />แสดง {months} เดือนล่าสุด</button>}
        </div>

        {visible.length ? <>
          <ul className="history-records">
            {visible.map((record, index) => {
              const animal = PETS.find((entry) => entry.id === record.pet) ?? UNKNOWN_PET;
              return <li className="history-record" key={record.id} style={{ "--row-index": index }}>
                <div className="history-pet"><Avatar pet={animal} size={66} /><div><strong>{animal.name}</strong><span>{animal.breed} <i>·</i> อายุ {animal.age} ปี</span></div></div>
                <div className="history-diagnosis"><small><CalendarDays size={15} />{fmtDate(record.date)}</small><strong>{diseaseName(record.disease)}</strong></div>
                <div className="history-risk-cell"><ResultBadge record={record} /></div>
                <button className="history-detail" onClick={(event) => { openerRef.current = event.currentTarget; setSelected({ ...record, animal }); }}>ดูรายละเอียด<ChevronRight size={17} /></button>

              </li>;
            })}
          </ul>
          {pages > 1 && <nav className="history-pagination" aria-label="เปลี่ยนหน้าประวัติ">
            <button aria-label="หน้าก่อน" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={18} /></button>
            {Array.from({ length: pages }, (_, index) => <button key={index} className={currentPage === index + 1 ? "active" : ""} aria-current={currentPage === index + 1 ? "page" : undefined} onClick={() => setPage(index + 1)}>{index + 1}</button>)}
            <button aria-label="หน้าถัดไป" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}><ChevronRight size={18} /></button>
          </nav>}
        </> : <section className="history-empty">
          <div className="history-empty-paw"><PawPrint size={34} /></div><h2>{HISTORY.length ? "ไม่พบประวัติที่ตรงกับตัวกรอง" : "ยังไม่มีประวัติการตรวจ"}</h2>
          <p>{HISTORY.length ? (scopeRows.length ? "ลองค้นหาด้วยคำอื่น หรือล้างตัวกรองเพื่อดูประวัติทั้งหมด" : `ไม่มีการตรวจใน${scopeLabel} ลองเลือกช่วงเวลาหรือสัตว์เลี้ยงอื่น`) : "เริ่มตรวจสุขภาพสัตว์เลี้ยงของคุณเพื่อบันทึกประวัติ"}</p>
          {HISTORY.length ? (scopeRows.length ? <button className="history-empty-cta secondary" onClick={clearFilters}>ล้างตัวกรอง</button> : null) : <Link className="history-empty-cta" to="/check"><PawPrint size={18} />เริ่มตรวจสุขภาพ</Link>}
        </section>}
      </>}

      {view === "details" && status === "loading" && <p className="history-list-status" role="status">กำลังโหลดประวัติการตรวจ…</p>}
      {view === "details" && status === "error" && <p className="history-list-status" role="alert">{error || petsError}</p>}
      </div>
      </div>

      {/* Rendered on <body> so the floating header never covers it; two columns on wide screens. */}
      {selected && createPortal(<div className="history-modal-backdrop" onClick={closeDetails} role="presentation">
        <section ref={modalRef} className="history-modal history-modal-wide" role="dialog" aria-modal="true" aria-labelledby="history-detail-title" tabIndex={-1} onClick={(event) => event.stopPropagation()}>
          <button ref={closeRef} className="history-modal-close" onClick={closeDetails} aria-label="ปิด"><X size={20} /></button>
          <div className="history-modal-pet"><Avatar pet={selected.animal} size={72} /><div><h2 id="history-detail-title">ผลการตรวจของ {selected.animal.name}</h2><span>{selected.animal.breed} · อายุ {selected.animal.age} ปี</span></div></div>
          <div className="history-modal-grid">
            <div className="history-modal-col">
              <div className="history-modal-result"><small><Clock3 size={15} />{fmtDate(selected.date)}</small><strong>{diseaseName(selected.disease)}</strong><ResultBadge record={selected} /></div>
              <div className="history-modal-photo"><HistoryPhoto record={selected} /></div>
              <OwnerContextSummary context={selected.owner_context} />
            </div>
            <div className="history-modal-col history-modal-advice">
              <div className="history-modal-care"><CareAdvice key={selected.id} disease={selected.disease} saved={selected.care_advice ?? undefined} /></div>
              <p className="history-modal-note">ระบบบันทึกผลการตรวจเบื้องต้นนี้เพื่อใช้อ้างอิง หากสัตว์เลี้ยงมีอาการผิดปกติ ควรปรึกษาสัตวแพทย์</p>
            </div>
          </div>
        </section>
      </div>, document.body)}
    </div>
  );
}
