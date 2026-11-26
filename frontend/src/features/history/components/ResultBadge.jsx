import { ShieldCheck, AlertTriangle } from 'lucide-react';
import { riskText } from '../utils/risk-text.js';
export default function ResultBadge({ record }) {
return <span className={`history-result ${record.risk}`}>
    {record.risk === "low" ? <ShieldCheck size={15} /> : <AlertTriangle size={15} />}
    {riskText[record.risk] || "ไม่ระบุระดับ"}
  </span>;
}

