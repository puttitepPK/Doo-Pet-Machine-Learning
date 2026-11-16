# Pet Health AI

## Supabase

1. ตั้งค่า `VITE_SUPABASE_URL` และ `VITE_SUPABASE_PUBLISHABLE_KEY` ในไฟล์ `.env.local` ที่อยู่ข้าง `package.json`
2. ใน Supabase SQL Editor ใช้ `database/004_supabase_full_schema.sql` หลังจากรัน 003 แล้ว สำหรับโปรเจกต์ใหม่ให้รัน 003 ก่อน ส่วนโปรเจกต์ที่ใช้งาน 003 อยู่ให้รันเฉพาะ 004
   SQL นี้สร้างตารางจากโครงสร้าง 001 โดยใช้ Supabase Auth, คัดลอกสัตว์เลี้ยงเดิม และรวมประวัติเดิมกับผลใหม่ในหน้าประวัติ
3. ใน Authentication → URL Configuration ตั้ง Site URL และเพิ่ม Redirect URLs ให้ตรงกับ URL ที่เปิดเว็บ เช่น `http://localhost:5173/` และ URL ของเว็บจริง เพื่อให้ลิงก์ยืนยันอีเมลและลิงก์กู้รหัสผ่านกลับเข้าเว็บได้
4. รัน `npm install` แล้ว `npm run dev` เปิดหน้าเว็บและสมัครสมาชิก จากนั้นยืนยันอีเมลหากเปิด Confirm email ใน Supabase
5. เพิ่มสัตว์เลี้ยงใน ตั้งค่าบัญชี → My pet แล้วเลือกสัตว์เลี้ยงในหน้าตรวจเพื่อบันทึกผล

บัญชีและโปรไฟล์ใช้ Supabase Auth ข้อมูลใหม่เก็บใน 10 ตารางตามโครงสร้าง 001 รวมไฟล์ภาพใน private bucket `doo-pet-skin` และผลของทุกโมเดลที่ฝึกแล้วที่ API โหลดอยู่ หน้ารายละเอียดประวัติแสดงคำแนะนำตามกลุ่มที่บันทึกไว้ ข้อมูลจากโหมดจำลองเดิมอยู่ในเบราว์เซอร์เดิมและไม่ได้ย้ายอัตโนมัติ

การทำนายภาพใช้ FastAPI หาก API อยู่คนละที่กับค่าเริ่มต้น `http://127.0.0.1:8000` ให้ตั้ง `VITE_API_URL` ใน `.env.local`

## แบบฐานข้อมูลเดิม

ดู [แบบฐานข้อมูล PostgreSQL](database/README.th.md) สำหรับโครงสร้างที่ออกแบบไว้ก่อนเชื่อม Supabase

## คำแนะนำการดูแลด้วย Gemini

สร้างคีย์ที่ [Google AI Studio](https://aistudio.google.com/apikey) แล้วรันคำสั่งจากโฟลเดอร์ pet-health-ai

```powershell
python -m pip install -r model/requirements.txt
if (-not (Test-Path .env.local)) { Copy-Item model/.env.local.example .env.local }
```

ใส่คีย์ของคุณหลัง GEMINI_API_KEY= ใน .env.local ข้าง package.json แล้วเริ่ม FastAPI ด้วย python model/main.py ใช้ไฟล์ตัวอย่างสำหรับแชร์กับเพื่อน ส่วนไฟล์ .env.local ถูกละเว้นจาก Git หากตั้ง GEMINI_API_KEY ใน PowerShell หรือเซิร์ฟเวอร์ไว้ด้วย ระบบจะใช้ค่านั้นก่อน โดย model/.env.local ยังใช้เป็นค่ารองได้

หน้าตรวจจะแสดงผลคัดกรองแล้วขอคำแนะนำจาก FastAPI ถ้าไม่ได้ตั้งคีย์หรือ Gemini ไม่ตอบ ระบบใช้ข้อความสำรองตามกลุ่มผิวหนัง
