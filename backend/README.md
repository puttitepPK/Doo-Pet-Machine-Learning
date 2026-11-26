# Pet Health AI

Frontend ย้ายไป [`../frontend/`](../frontend/README.md) แล้ว ส่วน `model/` และ `database/` ยังอยู่ที่เดิม
คำสั่ง npm ทั้งหมดให้รันจาก `frontend/` ดู [โครงสร้างใหม่](../docs/frontend-structure.md)

## Supabase

1. ตั้งค่า `VITE_SUPABASE_URL` และ `VITE_SUPABASE_PUBLISHABLE_KEY` ในไฟล์ `../frontend/.env.local`
2. ใน Supabase SQL Editor ใช้ `database/004_supabase_full_schema.sql` หลังจากรัน 003 แล้ว สำหรับโปรเจกต์ใหม่ให้รัน 003 ก่อน ส่วนโปรเจกต์ที่ใช้งาน 003 อยู่ให้รันเฉพาะ 004
   SQL นี้สร้างตารางจากโครงสร้าง 001 โดยใช้ Supabase Auth, คัดลอกสัตว์เลี้ยงเดิม และรวมประวัติเดิมกับผลใหม่ในหน้าประวัติ
3. ใน Authentication → URL Configuration ตั้ง Site URL และเพิ่ม Redirect URLs ให้ตรงกับ URL ที่เปิดเว็บ เช่น `http://localhost:5173/` และ URL ของเว็บจริง เพื่อให้ลิงก์ยืนยันอีเมลและลิงก์กู้รหัสผ่านกลับเข้าเว็บได้
4. รัน `npm ci` แล้ว `npm run dev` จาก `../frontend/` เปิดหน้าเว็บและสมัครสมาชิก จากนั้นยืนยันอีเมลหากเปิด Confirm email ใน Supabase
5. เพิ่มสัตว์เลี้ยงใน ตั้งค่าบัญชี → My pet แล้วเลือกสัตว์เลี้ยงในหน้าตรวจเพื่อบันทึกผล

บัญชีและโปรไฟล์ใช้ Supabase Auth ข้อมูลใหม่เก็บใน 10 ตารางตามโครงสร้าง 001 รวมไฟล์ภาพใน private bucket `doo-pet-skin` และผลของทุกโมเดลที่ฝึกแล้วที่ API โหลดอยู่ หน้ารายละเอียดประวัติแสดงคำแนะนำตามกลุ่มที่บันทึกไว้ ข้อมูลจากโหมดจำลองเดิมอยู่ในเบราว์เซอร์เดิมและไม่ได้ย้ายอัตโนมัติ

การทำนายภาพใช้ FastAPI หาก API อยู่คนละที่กับค่าเริ่มต้น `http://127.0.0.1:8000` ให้ตั้ง `VITE_API_URL` ใน `../frontend/.env.local`

## แบบฐานข้อมูลเดิม

ดู [แบบฐานข้อมูล PostgreSQL](database/README.th.md) สำหรับโครงสร้างที่ออกแบบไว้ก่อนเชื่อม Supabase

## คำแนะนำการดูแลด้วย Gemini

โค้ด LLM อยู่ใน [`model/llm/`](model/llm/README.md) แยก Router, Service, Gemini client, Config, Prompt และ validation แล้ว โดยใช้ API URL เดิม

สร้างคีย์ที่ [Google AI Studio](https://aistudio.google.com/apikey) แล้วรันคำสั่งจากโฟลเดอร์ backend

```powershell
python -m pip install -r model/requirements.txt
# ตั้ง GEMINI_API_KEY ใน .env.local ของโฟลเดอร์นี้ หรือใน Environment ของ Backend
```

ใส่คีย์ของคุณหลัง GEMINI_API_KEY= ใน `backend/.env.local` แล้วเริ่ม FastAPI ด้วย `python model/main.py` ส่วนไฟล์ `.env.local` ถูกละเว้นจาก Git หากตั้ง GEMINI_API_KEY ใน PowerShell หรือเซิร์ฟเวอร์ไว้ด้วย ระบบจะใช้ค่านั้นก่อน โดย `model/.env.local` ยังใช้เป็นค่ารองได้ ห้ามใส่คีย์นี้ใน `frontend/` หรือใช้ชื่อ `VITE_GEMINI_API_KEY`

หน้าตรวจจะแสดงผลคัดกรองแล้วขอคำแนะนำจาก FastAPI ถ้าไม่ได้ตั้งคีย์หรือ Gemini ไม่ตอบ ระบบใช้ข้อความสำรองตามกลุ่มผิวหนัง
