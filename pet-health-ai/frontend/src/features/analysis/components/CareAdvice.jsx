import { useEffect, useState } from "react";
import { careHeadings, loadCareAdvice } from "../services/care-advice.js";
import { useAuth } from "../../auth/hooks/useAuth.js";

export default function CareAdvice({ disease, saved }) {
  const { user } = useAuth();
  const [loaded, setLoaded] = useState(null);
  const care = saved ?? loaded;
  const tips = Array.isArray(care?.context_tips?.items) ? care.context_tips.items.filter((tip) => typeof tip === "string" && tip.trim()) : [];

  useEffect(() => {
    if (saved !== undefined) return;
    const controller = new AbortController();
    void loadCareAdvice(disease, controller.signal, { adviceScope: user?.id ?? 'guest' }).then(result => {
      if (!controller.signal.aborted) setLoaded(result);
    });
    return () => controller.abort();
  }, [disease, saved, user?.id]);

  return <>
    <h3>คำแนะนำการดูแลเบื้องต้น</h3>
    {care ? <ul aria-live="polite">{care.items.map((advice, index) => (
      <li key={careHeadings[index]}><strong>{careHeadings[index]}</strong> — {advice}</li>
    ))}</ul> : <p role="status">กำลังเตรียมคำแนะนำ…</p>}
    {tips.length > 0 && <div className="care-context-tips">
      <h4>สิ่งที่ควรสังเกตและจดเพิ่ม จากข้อมูลที่คุณระบุ</h4>
      <ul>{tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
      <small>เป็นคำแนะนำให้สังเกตเพิ่มเติม ไม่ได้ยืนยันโรคหรือสาเหตุ</small>
    </div>}
  </>;
}
