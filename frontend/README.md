# Doo Pet Frontend

React + Vite เดิม แบ่ง `src/features/` ตามงาน และ `src/shared/` สำหรับส่วนที่ใช้ร่วมกัน
ดูรายละเอียดและตารางย้ายไฟล์ใน [frontend-structure.md](../docs/frontend-structure.md)

## เปิดเว็บ

จากราก Repository:

```powershell
cd frontend
npm ci
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm run dev
```

ตั้งค่าใน `frontend/.env.local`:

- `VITE_API_URL` ค่าเริ่มต้น `http://127.0.0.1:8000`
- `VITE_SUPABASE_URL` และ `VITE_SUPABASE_PUBLISHABLE_KEY` สำหรับบัญชีและข้อมูล
- `VITE_GEOAPIFY_API_KEY` สำหรับค้นหาคลินิก ใช้คีย์ที่อนุญาตโดเมนเว็บ

Vite ใช้ Environment ข้าง `frontend/package.json` ไม่ได้โหลด `.env.local` ที่ราก Repository
ห้ามใส่ Gemini key หรือ Supabase service role key ในค่า `VITE_*`
Backend ยังใช้ `backend/.env.local` หรือ `backend/model/.env.local` ตามเดิม

เปิดอีก Terminal จากราก Repository:

```powershell
cd backend/model
python main.py
```

## ตรวจสอบ

รันจาก `frontend/`:

```powershell
npm run build
npm run lint
node --test src/features/analysis/utils/owner-context.test.js src/features/history/utils/tracking-chart.test.js src/features/analysis/services/prediction-api.test.js
node scripts/smoke-render.mjs
node scripts/check-structure.mjs
```

SSR smoke ใช้ข้อมูลบัญชีจำลองเฉพาะใน test server ไม่เชื่อมบัญชีหรือข้อมูลจริง และไม่ทดแทน Browser tests
หาก shell ใน sandbox เรียก npm lint ไม่ได้ สามารถเรียก ESLint โดยตรงด้วย
`node node_modules/eslint/bin/eslint.js .`

## Supabase และเส้นทาง

คำแนะนำฐานข้อมูลเดิมอยู่ใน [backend/README.md](../backend/README.md)
ตั้ง Site URL และ Redirect URLs ใน Supabase ให้ตรงกับเว็บ เช่น `http://localhost:5173/`
การย้ายครั้งนี้ไม่ต้องเปลี่ยน schema หรือรัน SQL เพิ่ม
ข้อมูลบัญชี ประวัติ และรูปผู้ใช้ยังใช้ Supabase Auth, RPC และ private bucket `doo-pet-skin` เดิม

คง HashRouter และ `/check`, `/history`, `/clinics`, `/settings`, `/about`, `/login`, `/signup`
`/` ส่งไป `/check` ตามเดิม หน้า Home ยังเก็บไว้แต่ไม่ได้ผูก Route
History แสดงคำเชิญเข้าสู่ระบบเมื่อไม่มีบัญชี ส่วน Settings ส่งไปหน้า Login
