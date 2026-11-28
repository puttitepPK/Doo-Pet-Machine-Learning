# ส่วน LLM ของ Doo Pet

ส่วนนี้รับผลคัดกรองภาพและข้อมูลที่เจ้าของระบุ แล้วสร้างข้อความแนะนำการดูแลผ่าน Gemini
ผลภาพและคะแนนมาจากโมเดลภาพเท่านั้น LLM ไม่ประเมินภาพใหม่หรือแก้คะแนน

## เริ่มแก้งานตรงไหน

| งาน | ไฟล์ |
| --- | --- |
| แก้คำสั่งที่ส่งให้ Gemini | `prompts.py` |
| แก้คำแนะนำสำรองเมื่อเรียก Gemini ไม่สำเร็จ | `care_advice.py` → `OPTIONS` |
| แก้คำแนะนำตามข้อมูลเจ้าของ, fallback หรือกฎตรวจข้อความ | `care_context.py` |
| แก้ช่องข้อมูล/รหัสตัวเลือก/validation | `owner_context.py` (ต้องตรวจให้ตรงกับ Frontend) |
| แก้ชื่อโมเดล, timeout หรือจำนวนคำขอทั่วไปที่ทำพร้อมกัน | `config.py` |
| แก้วิธีเรียก Gemini และอ่าน response | `gemini_client.py` |
| แก้การประสานคำแนะนำและข้อมูลเจ้าของ | `service.py` |
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
  variation.py
  README.md
```

## เส้นทางการทำงาน

```text
Frontend → main.py → llm/router.py → service.py
                                      └─ care_advice.py → Gemini สร้างคำแนะนำ 3 ข้อ
                                             └─ เมื่อมีข้อมูลเจ้าของ: สร้าง tips ในคำขอเดียวกัน
                                               ↓
                                  gemini_client.py → Gemini HTTP API
```

Prompt อยู่ใน `prompts.py` คำแนะนำหลักสร้างได้ทั้งเมื่อมีและไม่มีข้อมูลเจ้าของ
`OPTIONS` เป็นแนวทางอ้างอิงที่ส่งให้ Gemini และเป็น fallback เท่านั้น Gemini คืน `items` ครบ 3 ข้อ ไม่คืนเลข `choice`
คำแนะนำทุกหัวข้อรวมถึง tips ถูกสั่งไม่ให้กล่าวถึงยา แม้เป็นคำเตือนว่าไม่ควรใช้ยาเอง
ให้เน้นลดการเลียเกา งดบีบตุ่มหรือแกะสะเก็ด หลีกเลี่ยงการขัดถู และติดตามอาการแทน
คำตอบสำรองทั้ง Backend และ Frontend ใช้ข้อความที่ไม่กล่าวถึงยาเช่นกัน
เมื่อมีข้อมูล เจ้าของจะถูกส่งเป็น `owner_reported` แยกจาก `image_result` และใช้ประกอบคำแนะนำหลักและ tips
เรียก Gemini พร้อมกันทั้งสองส่วน โดยตรวจผลลัพธ์และใช้ fallback ของแต่ละส่วนแยกกัน
หากข้อความซ้ำกับคำตอบล่าสุดหรือ tips ซ้ำกับ items จะขอให้เขียนใหม่ได้หนึ่งครั้ง ภายในเวลารอรวมเดิม
`care_context.py` เก็บกฎตรวจข้อความและ fallback ของ tips รวมถึงฟังก์ชันเรียก tips แยกสำหรับผู้เรียกโดยตรง
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

Frontend ใช้ POST ทั้งกรณีกรอกและไม่กรอก โดยรับข้อมูลเพิ่มแบบ optional:

- `variation_index`: เลข 0–5 เพื่อสลับแนวเขียน โดยยังคงลำดับหัวข้อทั้ง 3 เดิม
- `previous_advice`: `{ "items": ["...", "...", "..."], "tips": ["..."] }` โดยส่งได้เฉพาะส่วนที่มี

คำแนะนำล่าสุดเก็บใน `sessionStorage` ของแท็บ แยกตามบัญชีและ label มี memory fallback เมื่อ storage ใช้ไม่ได้
ไม่มี cache ข้อความร่วมระหว่างผู้ใช้ใน Backend ไม่ใช้ข้อมูลนี้เปลี่ยนผลภาพ และไม่แก้คำแนะนำที่บันทึกในประวัติ
คำตอบที่กลับมาช้าจากคำขอเก่าจะไม่ทับคำตอบล่าสุดในเซสชัน
GET เดิมและ POST ที่ไม่ส่งข้อมูลสองช่องใหม่นี้ยังเรียกได้ตามเดิม

## Environment และการเปิด Backend

ตั้ง `GEMINI_API_KEY` ใน Environment ของ process หรือ `backend/.env.local`
ลำดับค่าคือ process Environment → `backend/.env.local` → `backend/model/.env.local`
ไฟล์ Environment เดิมไม่ถูกย้ายหรือแก้ไข และไม่พิมพ์ค่าคีย์ลง log
ห้ามนำคีย์นี้ไปตั้งชื่อ `VITE_*` หรือวางใน Frontend

สาเหตุ Fallback ที่ตรวจพบในเครื่องนี้: `GEMINI_API_KEY` อยู่ใน `frontend/.env.local` ซึ่ง Backend ไม่ได้โหลด
ย้ายเฉพาะคีย์ไป `backend/.env.local` ที่ Git ignore แล้ว และลบคีย์จากไฟล์ Frontend โดยไม่แสดงค่า
Backend ที่เปิดค้างก่อนแก้ต้องเริ่มใหม่เพื่อโหลด Environment และโค้ดใหม่

Terminal แยกเหตุผลด้วย `category` / `reason` / `section`:

- `configuration / missing_api_key`: ไม่มีคีย์ใน Backend
- `capacity / concurrency_limit`: ช่องประมวลผลเต็ม
- `provider / http_error` พร้อมสถานะ HTTP หรือ `timeout_or_network_error`: เรียก Gemini ไม่สำเร็จ
- `response / invalid_json_or_payload`, `missing_or_invalid_object`: รูปแบบคำตอบผิดหรือ generation ไม่จบ (transport แสดง finish reason แบบรหัสที่กำหนดไว้)
- `validation / invalid_items`, `invalid_tips`, `repeated_items`, `repeated_tips`: ข้อความไม่ผ่านกฎหรือซ้ำ

Log เหตุผลไม่แสดงคีย์ prompt ข้อมูลเจ้าของ หรือ body ของ error จาก provider
เมื่อมีข้อมูลเจ้าของหรือคำตอบก่อนหน้า Terminal แสดงเฉพาะแหล่งที่มา ส่วนข้อความคำแนะนำอ่านได้ที่หน้าเว็บ
เพราะข้อความที่สร้างอาจมีรายละเอียดจากเจ้าของปนอยู่

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

ผลตรวจล่าสุด: ชุด LLM 51 รายการผ่าน รวม API เดิม/ใหม่ การเขียนใหม่เมื่อซ้ำ การแยก fallback
การไม่เปิดเผยข้อมูลใน log และการปฏิเสธคำแนะนำใช้ยา พร้อมอนุญาตข้อความเตือนให้งดใช้ยาเอง
Frontend tests ของคำแนะนำและข้อมูลเจ้าของ 11 รายการผ่าน; build ผ่าน; lint เฉพาะไฟล์ที่แก้ผ่าน
Lint ทั้ง Frontend ยังมีปัญหาเดิมใน `HistoryPage.jsx` และ `Dropdown.jsx` ที่อยู่นอกงานนี้

ทดสอบจริงวันที่ 2026-11-28 ผ่านหน้าเว็บด้วย `agent-browser`, โมเดลภาพจริง และ Gemini จริง
ใช้ `learned_data/demodicosis/1_tight_crop.jpg` รูปเดิมทุกครั้ง (ชื่อโฟลเดอร์ไม่ใช่ผลทำนาย):

| กรณี | จำนวนรอบ | คำแนะนำหลัก | tips | ถ้อยคำต่างกันทุกหัวข้อ |
| --- | --- | --- | --- | --- |
| ไม่กรอกข้อมูลเพิ่ม | 3 | Gemini 3/3 | ไม่มี | 3 แบบต่อหัวข้อ |
| คัน, ท้อง, 2–3 วัน, เปลี่ยนแชมพู | 3 | Gemini 3/3 | Gemini 3/3 | 3 แบบต่อหัวข้อ |

ผลภาพทุกรอบเป็น `dermatitis`, score `0.6755` เหมือนเดิม Tips อ้างถึงเวลาที่เกา บริเวณท้อง
และการจดเปรียบเทียบก่อน/หลังใช้ผลิตภัณฑ์ โดยไม่ได้สรุปว่าเป็นสาเหตุ
หลักฐานคำตอบและผลเทียบอยู่ใน `../tests/llm/gemini_live_checks.json` ใช้ข้อมูลแบบฟอร์มจำลองทั้งหมด
ทดสอบแบบ guest เพื่อไม่เพิ่มรายการในประวัติบัญชีจริง; การแยกบัญชีตรวจด้วย automated tests
ทดสอบบน Backend 8001 และ Frontend 5174 แยกจากเซิร์ฟเวอร์เดิมที่ผู้ใช้เปิดอยู่

ตรวจเพิ่มเติมกรณี `bacterial_dermatosis` ที่เคยขึ้น Fallback พบ false positive ในตัวตรวจข้อความ:
คำเตือนแบบรายการ “หลีกเลี่ยง…และใช้ยา…เอง” สูญเสียขอบเขตคำปฏิเสธเมื่อแยกคำว่า “และ”
และการแนะนำให้พบสัตวแพทย์เพื่อตรวจวินิจฉัยถูกนับเป็นการวินิจฉัยโดยระบบเอง
แก้ให้ยอมรับคำเตือนและการส่งต่อสัตวแพทย์ โดยยังปฏิเสธการสั่งยาและการยืนยันโรค
Log การปฏิเสธข้อความแสดงรหัสสาเหตุเพิ่มเติม โดยไม่แสดงข้อความที่ถูกตรวจ
เมื่อเริ่ม Backend จะพิมพ์ `mode=generated_items_v2` และสถานะ `key_configured` โดยไม่พิมพ์คีย์

หลังเริ่ม Backend จริงบนพอร์ต 8000 ใหม่ ทดสอบ POST ด้วยผล `bacterial_dermatosis`, score `0.7998`
แบบไม่กรอกข้อมูล 3 รอบ และแบบคัน/ลำตัว/เปลี่ยนสถานที่ไปเล่น 3 รอบ ผ่าน Gemini ทั้งหมด
กรณีกรอกได้ `context_tips.source=gemini` ครบ 3 รอบ และแต่ละหัวข้อมีข้อความต่างกัน 3 แบบในทั้งสองกรณี
การตรวจเพิ่มเติมรอบนี้เรียก API คำแนะนำโดยตรง ไม่ได้ส่งภาพไปประเมินใหม่

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

## เวลารอและ Concurrency

เส้นทาง GET/POST มีเวลารอรวม 18 วินาที ครอบคลุมทั้ง items และ tips และการขอเขียนใหม่เมื่อซ้ำไม่เกินหนึ่งครั้ง
ใช้ semaphore ร่วม 2 ช่อง หากไม่มีคีย์ ช่องเต็ม หรือ provider ล้มเหลวจะคืนข้อความสำรอง
Frontend รอ POST 22 วินาที ไม่เรียก GET ซ้ำเมื่อ POST ล้มเหลว จึงไม่สูญเสียบริบทหรือเพิ่มเวลารอซ้อนกัน
