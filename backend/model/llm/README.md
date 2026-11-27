# ส่วน LLM ของ Doo Pet

ส่วนนี้รับผลคัดกรองภาพและข้อมูลที่เจ้าของระบุ แล้วสร้างข้อความแนะนำการดูแลผ่าน Gemini
ผลภาพและคะแนนมาจากโมเดลภาพเท่านั้น LLM ไม่ประเมินภาพใหม่หรือแก้คะแนน

## เริ่มแก้งานตรงไหน

| งาน | ไฟล์ |
| --- | --- |
| แก้คำสั่งที่ส่งให้ Gemini | `prompts.py` |
| แก้ชุดคำแนะนำทั่วไปที่ให้เลือก | `care_advice.py` → `OPTIONS` |
| แก้คำแนะนำตามข้อมูลเจ้าของ, fallback หรือกฎตรวจข้อความ | `care_context.py` |
| แก้ช่องข้อมูล/รหัสตัวเลือก/validation | `owner_context.py` (ต้องตรวจให้ตรงกับ Frontend) |
| แก้ชื่อโมเดล, timeout หรือจำนวนคำขอทั่วไปที่ทำพร้อมกัน | `config.py` |
| แก้วิธีเรียก Gemini และอ่าน response | `gemini_client.py` |
| แก้การประสานคำแนะนำทั้งสองงาน | `service.py` |
| แก้ HTTP request validation และ endpoint | `router.py` |
| เพิ่ม regression test | `../tests/llm/` |

```text
llm/
  __init__.py
  config.py
  prompts.py
  gemini_client.py
  care_advice.py
  care_context.py
  owner_context.py
  service.py
  router.py
  README.md
```

## เส้นทางการทำงาน

```text
Frontend → main.py → llm/router.py → service.py
                                      ├─ care_advice.py  → Gemini เลือกข้อความจาก OPTIONS
                                      └─ care_context.py → Gemini สร้างสิ่งที่ควรสังเกตเพิ่ม
                                               ↓
                                  gemini_client.py → Gemini HTTP API
```

Prompt อยู่ใน `prompts.py` ทั้งสองงานใช้ HTTP client และชื่อโมเดลจาก Config เดียวกัน
แต่ยังแยกกฎตรวจผลลัพธ์และ fallback ตามหน้าที่
นำเข้า `llm.router` หรือ `model.llm.router` ได้โดยไม่โหลด Torch, CLIP, weights หรือไฟล์ Environment
`main.py` เรียก `load_environment()` อย่างชัดเจนก่อนโหลดโค้ด inference แล้วเชื่อม Router ด้วย `app.include_router(llm_router)`

## API ที่คงเดิม

`GET /care-advice?label=healthy` รับเฉพาะ label ของผลคัดกรอง 6 กลุ่มเดิม และคืน:

```json
{"items": ["ข้อความที่ 1", "ข้อความที่ 2", "ข้อความที่ 3"], "source": "fallback"}
```

`POST /care-advice` รับ JSON:

```json
{
  "label": "dermatitis",
  "score": 0.8,
  "owner_context": {"version": 1, "symptoms": ["itching"]}
}
```

คืน `items`, `source`, `owner_context` ที่ normalize แล้ว และ `context_tips`
`source` ของคำแนะนำแต่ละส่วนเป็น `gemini` หรือ `fallback` ได้แยกกัน
เมื่อไม่มีข้อมูลประกอบ `owner_context` และ `context_tips` เป็น `null` ตามเดิม
label/score/context ที่ไม่ถูกต้องยังได้ HTTP 422 และข้อความเดิม
ไม่เพิ่ม prefix `/llm` ให้ URL จึงไม่ต้องแก้ Frontend

## Environment และการเปิด Backend

ตั้ง `GEMINI_API_KEY` ใน Environment ของ process หรือ `backend/.env.local`
ลำดับค่าคือ process Environment → `backend/.env.local` → `backend/model/.env.local`
ไฟล์ Environment เดิมไม่ถูกย้ายหรือแก้ไข และไม่พิมพ์ค่าคีย์ลง log
ห้ามนำคีย์นี้ไปตั้งชื่อ `VITE_*` หรือวางใน Frontend

จากราก Repository:

```powershell
cd backend
python model/main.py
```

ยังเปิด API รวมที่พอร์ตเดิม รวมการโหลดโมเดลภาพตามเดิม
การพัฒนา/ทดสอบเฉพาะ LLM ใช้คำสั่งด้านล่างได้โดยไม่เปิด API รวม
หากฝัง Router ใน FastAPI อีกแอปหนึ่ง ให้เรียก `load_environment()` ที่จุดเริ่มแอปนั้นเอง

## Tests โดยไม่ใช้คีย์หรือ weights

จาก `backend/`:

```powershell
python -m unittest discover -s model/tests/llm -t . -v
```

Tests ใช้ `unittest` และ FastAPI ที่มีอยู่เดิม ไม่เพิ่ม SDK/dependency
Gemini ถูกจำลองทั้ง success, timeout/network error, JSON ผิดรูปแบบ และ generation ที่ยังไม่จบ
Router tests เรียก FastAPI ผ่าน ASGI ใน process โดยไม่เปิดพอร์ต ไม่เรียก Gemini จริง และไม่แตะฐานข้อมูล

ชุดนี้ครอบคลุมคำแนะนำทั่วไป/บริบท, validation, Prompt injection ที่อยู่ใน notes,
การคืน semaphore, รูปแบบ request/response, HTTP 422, ลำดับ service และ Environment precedence
การนำเข้าทั้งแบบ package และ script ถูกตรวจว่าไม่โหลดโมเดลภาพหรือ Environment โดยอัตโนมัติ

ผลตรวจรอบจัดโครงสร้าง: Tests เดิม 12 รายการผ่านก่อนย้าย และชุด LLM หลังย้าย 33 รายการผ่าน
ตรวจเทียบกับ Git baseline เพิ่มเติมแล้ว: OPTIONS, owner validation, Prompt และ Gemini request/response
ของทั้งสองงานในผลคัดกรองทั้ง 6 กลุ่มเหมือนเดิม รวมถึงฟังก์ชันที่ไม่ใช่ LLM ใน `main.py`

ข้อจำกัด: ไม่ได้เรียก Gemini จริงหรือเปิด API รวมพร้อมโมเดลภาพ
เมื่อทดลอง discover Tests ของ `model/tests/` ทั้งหมด พบชุด `test_saved_model_evaluation` import ไม่สำเร็จเพราะไม่มี `model.b3.evaluation_report`
ไฟล์ดังกล่าวอยู่นอกส่วน LLM และไม่ได้แก้ไขในงานนี้

## ตารางย้ายไฟล์

| เดิม (ใต้ model/) | ใหม่ |
| --- | --- |
| `care_advice.py` | `llm/care_advice.py` และแยก Prompt/Config/HTTP client |
| `care_context.py` | `llm/care_context.py` และแยก Prompt/Config/HTTP client |
| `owner_context.py` | `llm/owner_context.py` เนื้อหาเดิม |
| handlers ของ `/care-advice` ใน `main.py` | `llm/router.py` และ `llm/service.py` |
| `tests/test_owner_context.py` | `tests/llm/test_owner_context.py`, `test_care_context.py`, `fixtures.py` |

ผู้เรียกภายใน Repository ถูกปรับ Import แล้ว ไม่มี compatibility wrapper ที่ตำแหน่งเก่า
ผู้เรียกภายนอกที่ import Python modules เดิมต้องเปลี่ยนเป็น `model.llm.*` หรือ `llm.*` ตามวิธีเปิดโปรแกรม

## งานถัดไปที่ยังไม่เปลี่ยนในรอบนี้

- เวลารอ: งานทั่วไป timeout 7 วินาที และงานบริบท 8 วินาที ยังเรียกต่อกัน ขณะที่ Frontend รอ POST 12 วินาที ควรวางแผนเวลารอรวมให้สัมพันธ์กัน
- Concurrency: semaphore 2 ช่องยังครอบคลุมเฉพาะงานทั่วไปเหมือนเดิม งานบริบทยังไม่มี semaphore เดียวกัน
- การแก้ timeout/concurrency, เปลี่ยนโมเดล, เพิ่ม retry หรือเปลี่ยน Prompt ควรทำแยกจากงานย้ายโครงสร้าง พร้อม Tests ของพฤติกรรมใหม่
