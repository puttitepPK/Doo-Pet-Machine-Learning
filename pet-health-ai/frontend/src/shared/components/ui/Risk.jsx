import { RISK } from "../../constants/risk.js";
export const Risk = ({ level }) => <span className={`risk risk-${level}`}>{RISK[level] || "ไม่ระบุความมั่นใจ"}</span>;
