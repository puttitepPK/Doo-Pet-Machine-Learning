import { Link } from 'react-router-dom';
import { HeartPulse, Check as CheckIcon, AlertCircle, ImagePlus, MapPin, ArrowRight } from 'lucide-react';
import { diseaseName } from '../../../shared/constants/disease-labels.js';
import { Risk } from '../../../shared/components/ui/Risk.jsx';
import { Disclaimer } from '../../../shared/components/ui/Disclaimer.jsx';
import OwnerContextSummary from './OwnerContextSummary.jsx';
import CareAdvice from './CareAdvice.jsx';

export default function AnalysisResult({ resultHeading, preview, pet, file, top, risk, submitted, care, err, result, onNewCheck }) {
  return (
          <section className="check-result check-result-inline" aria-labelledby="check-result-heading">
            <h2 id="check-result-heading" ref={resultHeading} tabIndex={-1}><HeartPulse size={23} />ผลการวิเคราะห์เบื้องต้น</h2>
            <div className="check-result-pet">
              <img src={preview} alt={`รูปที่ใช้วิเคราะห์ของ ${pet?.name || "สุนัข"}`} />
              <div><small>ผลตรวจของ</small><strong>{pet?.name || "สุนัข"}</strong><span>{file?.name}</span></div>
              <span className="check-result-complete"><CheckIcon size={16} />วิเคราะห์เสร็จแล้ว</span>
            </div>
            <div className="check-primary-result"><small>ผลวิเคราะห์หลัก</small><div className="check-result-summary"><strong>{diseaseName(top.label)}</strong><Risk level={risk} /></div></div>
            <OwnerContextSummary context={submitted} />
            <CareAdvice key={preview} disease={top.label} saved={care} />
            {err && <p className="check-error" role="alert"><AlertCircle size={17} />{err}</p>}
            <details className="check-result-details">
              <summary>ดูผลวิเคราะห์เพิ่มเติม</summary>
              <p>3 อันดับที่โมเดลประเมินได้คะแนนสูงสุด</p>
              {result.slice(0, 3).map((item) => <div className="check-meter" key={item.label}><div><span>{diseaseName(item.label)}</span><b>{Math.round(item.score * 100)}%</b></div><i><span style={{ width: `${item.score * 100}%` }} /></i></div>)}
            </details>
            <Disclaimer>ผลนี้เป็นการคัดกรองเบื้องต้นเท่านั้น หากสุนัขมีอาการผิดปกติควรพบสัตวแพทย์</Disclaimer>
            <div className="check-result-actions">
              <button type="button" className="btn" onClick={onNewCheck}><ImagePlus size={18} />ตรวจรูปใหม่</button>
              <Link to="/clinics" className="check-clinic-link"><MapPin size={17} />ค้นหาคลินิกใกล้ฉัน<ArrowRight size={17} /></Link>
            </div>
          </section>
  );
}
