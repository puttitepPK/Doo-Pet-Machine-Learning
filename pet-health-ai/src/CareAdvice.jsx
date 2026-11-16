import { useEffect, useState } from "react";
import { careHeadings, loadCareAdvice } from "./care-advice.js";

export default function CareAdvice({ disease, saved }) {
  const [loaded, setLoaded] = useState(null);
  const care = saved ?? loaded;

  useEffect(() => {
    if (saved !== undefined) return;
    const controller = new AbortController();
    void loadCareAdvice(disease, controller.signal).then(result => {
      if (!controller.signal.aborted) setLoaded(result);
    });
    return () => controller.abort();
  }, [disease, saved]);

  return <>
    <h3>คำแนะนำการดูแลเบื้องต้น</h3>
    {care ? <ul aria-live="polite">{care.items.map((advice, index) => (
      <li key={careHeadings[index]}><strong>{careHeadings[index]}</strong> — {advice}</li>
    ))}</ul> : <p role="status">กำลังเตรียมคำแนะนำ…</p>}
    {care?.source === "gemini" && <small>จัดคำแนะนำด้วย Gemini</small>}
  </>;
}
