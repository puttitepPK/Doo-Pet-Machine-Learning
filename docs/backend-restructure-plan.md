# แผนจัดโครงสร้าง Backend (ยังไม่ดำเนินการ)

## สถานะและขอบเขต

ย้ายเฉพาะ Frontend ไป `frontend/` ส่วน FastAPI อยู่ที่ `pet-health-ai/model/main.py`
โมเดล, weights, metadata, CLIP guardrail, preprocessing, TTA, training และ `database/` ไม่ถูกแก้ไข
ไม่ได้เรียก `/learn` ไม่รัน SQL และไม่สร้างหรือลบข้อมูลจริง

## การเชื่อมต่อที่คงเดิม

| ผู้เรียก | Endpoint / บริการ | Contract ที่รักษา |
| --- | --- | --- |
| `features/analysis/services/prediction-api.js` | `POST /predict` | multipart field `image`; ผู้เยี่ยมชมรับ array; ผู้มีบัญชีและสัตว์เลี้ยงส่ง `?details=true` และรับ predictions/runs/selected_model/image_sha256 |
| `features/analysis/services/care-advice.js` | `GET /care-advice?label=...` | ข้อความดูแลทั่วไป พร้อม fallback และ timeout เดิม |
| บริการเดียวกันเมื่อมีข้อมูลเจ้าของ | `POST /care-advice` | JSON label, score, owner_context; ข้อมูลประกอบไม่ส่งเข้าโมเดล |
| Auth/Pets/History services | Supabase Auth, REST/RPC, Storage | ตาราง, columns, owner filters, bucket `doo-pet-skin` และ RPC เดิม |

API Base กลางคือ `frontend/src/shared/config/api.js` ใช้ `VITE_API_URL` และ default `http://127.0.0.1:8000` พร้อมตัด trailing slash หนึ่งตัวแบบเดิม
Frontend ไม่เรียก `/compare`, `/models` หรือ `/learn` ในการใช้งานหน้าเว็บปกติ
Backend มี CORS `allow_origins=["*"]` ตาม source เดิม จึงไม่ผูกกับตำแหน่งโฟลเดอร์ Frontend

ตรวจ source ของ endpoint และ regression tests ที่ขอบเขต `/predict` แล้ว
ทดลอง `GET http://127.0.0.1:8000/models` แบบอ่านอย่างเดียวเมื่อ 26 พฤศจิกายน 2026 ได้ `ECONNREFUSED`
จึงยังไม่ได้ยืนยัน live inference หรือ care advice ผ่าน Backend จริง ไม่ได้เปิดโมเดลเอง

## โครงสร้างที่เสนอสำหรับรอบถัดไป

```text
backend/
  app/
    main.py              FastAPI, middleware, startup/lifespan
    routes/
      prediction.py      /predict, /compare
      care_advice.py     GET/POST /care-advice
      models.py          GET /models
      learning.py        /learn
    services/
      care_advice.py     Gemini, timeout, fallback
      care_context.py    คำแนะนำจากข้อมูลประกอบเจ้าของ
      learning.py        ประสานการฝึกและบันทึก weights
    inference/
      models.py          architecture และ model registry
      guardrail.py       CLIP dog/lesion guardrail
      preprocessing.py  EXIF, RGB, resize/normalize
      tta.py             recipes, metadata และ override เดิม
      prediction.py     รวมผลและเลือกโมเดล
    schemas/
      owner_context.py  validation ที่ตรง Frontend
      prediction.py     response ที่คง API contract
  weights/              .pth และ metadata
  tests/                ย้าย/ขยายจาก model/tests
```

เป็นข้อเสนอ ยังไม่ได้สร้างโฟลเดอร์หรือย้าย Backend
`database/` ควรจัดเป็นงาน migrations แยกภายหลังโดยไม่รันระหว่างย้าย source

## ลำดับดำเนินการรอบถัดไป

1. เก็บ fixtures response และ inference อ้างอิงจาก weights/metadata เดิม รวม default model, scores, class order และ error codes
2. กำหนด path จาก `__file__` และ Environment ก่อนย้าย เก็บ backup weights และ learned data ครบ
3. แยก pure validation/preprocessing ก่อน ตามด้วย services, model registry และ routes ทีละส่วน
4. ย้าย tests และเปรียบเทียบ tensors, TTA recipes/views และ inference กับ baseline ภายใต้ seed/device เดียวกัน
5. ตรวจ `/predict` ธรรมดา/รายละเอียด, `/compare`, `/models`, care advice GET/POST และ CORS จาก Frontend ใหม่
6. ทดสอบ `/learn` เฉพาะ weights สำเนาและ learned data ชุดแยกที่ได้รับอนุญาต

## Environment

Backend โหลด `pet-health-ai/.env.local` แล้ว `pet-health-ai/model/.env.local` โดย Environment ของ process มาก่อนตาม `load_dotenv(..., override=False)`
คงไฟล์เหล่านี้ไว้ ไม่ย้าย Gemini key ไป Browser
พบชื่อ `VITE_GEMINI_API_KEY` ใน `.env.local` ที่ราก Repository เดิม คงไฟล์งานเดิมไว้และไม่ได้คัดลอกค่านี้ไป Frontend
Frontend ใหม่ไม่ได้โหลด Environment จากราก Repository และไม่อ้างชื่อ Gemini key
หากคีย์ดังกล่าวเคยถูกเผยแพร่ไป Browser ให้ตรวจประวัติการเผยแพร่และเปลี่ยนคีย์ในงานดูแล secrets แยกต่างหาก
