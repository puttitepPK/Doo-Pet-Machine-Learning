# โครงสร้าง Frontend Doo Pet

## ขอบเขตและสถานะก่อนเริ่ม

ตรวจ Repository จริง ไม่พบ AGENTS.md สถานะ Git ก่อนเริ่มมีเฉพาะ .env.local ที่รากเป็น untracked และคงเนื้อหาไว้
Frontend เดิมอยู่ใน pet-health-ai/ ร่วมกับ model/ และ database/ รอบนี้ย้ายเฉพาะ Frontend
ไม่เปลี่ยน framework, ภาษา, dependency versions, schema, business logic หรือ API contract ไม่ commit/push
README ที่รากเดิมเป็น UTF-16LE เปลี่ยนเป็น UTF-8 เพื่อแก้คำสั่งเปิดเว็บและอ่านด้วยเครื่องมือทั่วไปได้

## โครงสร้างสุดท้าย (เฉพาะไฟล์จริง)

```text
frontend/
  .env.example
  .gitignore
  eslint.config.js
  index.html
  package-lock.json
  package.json
  public/
    avatars/
      profile-1.png
      profile-2.png
      profile-3.png
      profile-4.png
      profile-red-bandana.png
    dogs/
      about-dog.jpg
      buddy.jpg
      Buddy.png
      cartoon-dog-cutout.png
      choco.jpg
      Choco.png
      Dogประวัติ 1.jpg
      garden-background.png
      health-banner-background.png
      health-banner-cartoon-morning.png
      health-banner-clean.png
      health-banner-dog-gang-v2.png
      health-banner-emerald.png
      health-banner-grass.png
      health-banner-mocha-ivory.png
      health-banner-puppy.png
      health-banner-studio.png
      health-banner-warm-garden.png
      hero-golden-v2.jpg
      hero-golden.jpg
      HumanLogo (1).png
      HumanLogo (2).png
      HumanLogo (3).png
      HumanLogo (4).png
      ImageDog_BG_blown.png
      luna.jpg
      Luna.png
      milo.jpg
      Milpo.png
      puppy-running-cutout.png
      signup-dog-camp.png
      ตรวจสุขภาพสัตว์เลี้ยงด้วย AI_banner.png
    favicon.svg
    Happy Pet Care Paw Emblem.png
    icons.svg
    images/
      about/
        about-phone-check.webp
        about-phone-settings.webp
        golden-dog-cutout.png
      analysis/
        check-banner-set-2.png
        health-banner-dog-gang-clean.png
      auth/
        login-dog-portrait.png
      avatars/
        profile-1.png
        profile-2.png
        profile-3.png
        profile-4.png
        profile-red-bandana.png
      branding/
        doopet-navbar-symbol.png
        doopet-xml-logo-Photoroom.png
      clinics/
        clinic.png
      home/
        Golden-Retriever-PNG-File-Download-Free.png
      pets/
        Buddy.png
        Choco.png
        Luna.png
        Milpo.png
  README.md
  scripts/
    check-structure.mjs
    smoke-render.mjs
  src/
    app/
      App.jsx
      routes.jsx
    features/
      about/
        pages/
          AboutPage.jsx
        styles/
          About.css
      analysis/
        components/
          AnalysisResult.jsx
          CareAdvice.jsx
          OwnerContextForm.jsx
          OwnerContextSummary.jsx
        pages/
          CheckPage.jsx
        services/
          care-advice.js
          prediction-api.js
          prediction-api.test.js
        styles/
          OwnerContext.css
        utils/
          owner-context.js
          owner-context.test.js
      auth/
        hooks/
          useAuth.js
        pages/
          AuthPage.jsx
        services/
          auth-service.js
        styles/
          Auth.css
        utils/
          profile-avatars.js
      clinics/
        components/
          ClinicMap.jsx
        config.js
        pages/
          ClinicsPage.jsx
        services/
          clinics-api.js
        utils/
          map.js
      history/
        components/
          HealthSummaryChart.jsx
          HistoryPhoto.jsx
          ResultBadge.jsx
          SymptomTracking.jsx
          TrackingMatches.jsx
        hooks/
          useHistory.js
        pages/
          HistoryPage.jsx
        services/
          history-photo.js
          history-service.js
        styles/
          HealthSummaryChart.css
          SymptomTracking.css
        utils/
          health-chart.js
          risk-text.js
          tracking-chart.js
          tracking-chart.test.js
      home/
        data/
          demo.js
        pages/
          HomePage.jsx
      pets/
        components/
          DeletePetDialog.jsx
          PetEditor.jsx
        constants/
          default-pets.js
        hooks/
          usePets.js
        services/
          pet-service.js
      settings/
        pages/
          SettingsPage.jsx
        styles/
          Settings.css
    main.jsx
    shared/
      assets/
        hero.png
        react.svg
        vite.svg
      components/
        layout/
          Header.jsx
        ui/
          Avatar.jsx
          Disclaimer.jsx
          Dropdown.css
          Dropdown.jsx
          PageHead.jsx
          PhotoPicker.jsx
          Risk.jsx
      config/
        api.js
      constants/
        disease-labels.js
        risk.js
      hooks/
        useOwnedRows.js
        usePhotoUrls.js
      lib/
        supabase.js
      services/
        owned-rows.js
        photo-storage.js
      styles/
        App.css
        index.css
        Themes.css
      utils/
        confidence.js
        date.js
  vite.config.js
```

node_modules/ และ dist/ ถูกละเว้นในต้นไม้ข้างต้นและ Git ส่วน frontend/.env.local ถูกละเว้นเพื่อไม่เผยค่าจริง
เครื่องทำงานนี้ใช้ junction frontend/node_modules ไปยัง pet-health-ai/node_modules เดิมเพื่อใช้ dependencies ชุดเดิมโดยไม่ติดตั้ง/อัปเกรด
checkout ใหม่ใช้ npm ci ใน frontend/ ได้ตามปกติ ไม่ต้องใช้ junction
dist เดิมใน pet-health-ai/ คงไว้เป็น local baseline ไม่ใช่ตำแหน่ง Build ใหม่

## หน้าที่ของแต่ละหมวด

| หมวด | ความรับผิดชอบ |
| --- | --- |
| app | ประกอบ layout, HashRouter, theme, recovery redirect และ route table |
| features/home | หน้า Home เดิมและข้อมูล demo ที่ไม่มีผู้เรียกใน runtime ปัจจุบัน |
| features/auth | Login/signup/reset password, service/session store หนึ่งชุด, useAuth, ตัวเลือกรูปโปรไฟล์ |
| features/analysis | อัปโหลด/ประสานผล, AnalysisResult, care advice, owner context, prediction transport และ normalization |
| features/history | ประวัติ, summary/tracking charts, ResultBadge, รูปตรวจ, pure aggregation utilities และการบันทึกผล |
| features/pets | hooks/services สัตว์เลี้ยง, PetEditor, DeletePetDialog และ static avatar choices |
| features/clinics | หน้า Clinics, ClinicMap, Geoapify service และ pure map geometry/distance |
| features/settings | ประกอบบัญชี/รหัสผ่าน/จัดการสัตว์เลี้ยงและ styles ของหน้าตั้งค่า |
| features/about | หน้าอธิบายระบบและ styles |
| shared/components | Header layout และ Avatar/Risk/Disclaimer/PageHead/Dropdown/PhotoPicker ที่ใช้ข้ามฟีเจอร์ |
| shared/hooks, services | owner-row lifecycle และบริการ query; photo URL lifecycle และ Storage ที่ใช้ทั้งบัญชีและสัตว์เลี้ยง |
| shared/lib, config, utils, constants | Supabase client, API base, date/confidence และ disease/risk labels |
| shared/styles | global/reset/theme และ App.css ที่มี cascade ร่วมหลายหน้าตามเดิม |

Page ประสาน state และ service ส่วนการเรียก fetch/Supabase อยู่ใน services หรือ shared/lib
HistoryPage ยังถือ focus trap, filters และ selected record ตามเดิมเพื่อคง modal lifecycle โดยใช้ components กราฟ/รูปที่แยกอยู่แล้ว
ไม่เพิ่ม provider หรือ service ซ้อนหลายชั้น ไม่มี import จาก Page ไปใช้เป็น utility

## Routes, CSS และ lifecycle ที่รักษา

- HashRouter คงเดิม: / ส่งไป /check, route ไม่รู้จักส่งไป / แล้ว /check; Home ไม่ได้ผูก route ใหม่
- /check, /history, /clinics, /settings, /about, /login, /signup คงเดิม
- History ผู้เยี่ยมชมเห็นคำเชิญ Login; Settings ส่งไป Login; password recovery ส่งไป Settings
- key ตาม user.id ของ Header/Routes และ key login/signup คงเดิม จึงรักษาการ reset เมื่อเปลี่ยนบัญชี
- auth onAuthStateChange มีการลงทะเบียนระดับ module หนึ่งชุดเหมือนเดิม ไม่ย้ายไปสมัครซ้ำใน hook
- owner queries คง request version, owner guard, error/loading/empty และ event listener cleanup
- photo URL คงอายุ 3600 วินาที รีเฟรชทุก 50 นาที และ cleanup interval/active guard
- Supabase tables/columns/RPC/bucket และ fallback migration behavior คงเดิม
- AnalysisResult, PetEditor, DeletePetDialog และ ClinicMap เป็น module-level components; state อยู่ตำแหน่งเดิม
- App.css โหลดก่อน CSS ฟีเจอร์ ส่วน Themes.css อยู่ท้ายเหมือนเดิม CSS bundle หลัง Build เทียบ bytes ตรงกับ baseline (index-DskymkX6.css)
- เก็บ App.css กลางไว้เพราะ selector/override ทับกันหลายหน้า ย้าย CSS ที่แยกไฟล์อยู่แล้วไป styles ของฟีเจอร์ ไม่มีการเปลี่ยน selector หรือ CSS framework

## Environment และ static assets

คัดลอกเฉพาะค่า VITE_* ของ Frontend จาก pet-health-ai/.env.local ไป frontend/.env.local โดยไม่พิมพ์ค่า
Backend env เดิมและ root env เดิมไม่ถูกแก้ไข สร้าง frontend/.env.example ที่ไม่มี secret และ .gitignore ที่กัน *.local
พบชื่อ VITE_GEMINI_API_KEY ใน root .env.local เดิม ไม่คัดลอกเข้า Frontend และ Vite ใหม่ไม่โหลด env จากราก
Gemini ฝั่ง Backend ใช้ GEMINI_API_KEY ในตำแหน่งเดิม ห้ามใส่ใน Browser เช่นเดียวกับ service role key
VITE_API_URL ใช้ config กลาง คง default http://127.0.0.1:8000 และการตัด trailing slash แบบเดิม

ย้าย static images ที่ระบุหน้าที่ได้ไป public/images/branding, home, auth, about, analysis, clinics, avatars, pets
คงสำเนา public/avatars/* และ public/dogs/{Milpo,Buddy,Luna,Choco}.png เพื่อรองรับ URL ที่อาจบันทึกใน Supabase เดิม
profileAvatar ยอมรับทั้ง URL avatars เก่าและใหม่ ไม่แก้ข้อมูลจริงหรือ signed URL ในฐานข้อมูล
ตัวเลือกโปรไฟล์และรูปสัตว์เลี้ยงยังแสดงสถานะ selected เมื่อข้อมูลเดิมเก็บ URL เก่า ตรวจด้วย local SSR fixtures แล้ว
รูปผู้ใช้ยังอยู่ใน private bucket เดิม ไม่ย้ายเป็น static asset
ตรวจ hash แล้ว static assets เดิมครบ 50 ไฟล์ ไม่มีการลบ asset เพราะไม่พบผู้เรียก

## ตารางย้าย source และ config

| เดิม | ใหม่ |
| --- | --- |
| `pet-health-ai/src/App.jsx` | `frontend/src/app/App.jsx` |
| `pet-health-ai/src/pages/Home.jsx` | `frontend/src/features/home/pages/HomePage.jsx` |
| `pet-health-ai/src/pages/Auth.jsx` | `frontend/src/features/auth/pages/AuthPage.jsx` |
| `pet-health-ai/src/pages/Check.jsx` | `frontend/src/features/analysis/pages/CheckPage.jsx` |
| `pet-health-ai/src/pages/History.jsx` | `frontend/src/features/history/pages/HistoryPage.jsx` |
| `pet-health-ai/src/pages/Clinics.jsx` | `frontend/src/features/clinics/pages/ClinicsPage.jsx` |
| `pet-health-ai/src/pages/Settings.jsx` | `frontend/src/features/settings/pages/SettingsPage.jsx` |
| `pet-health-ai/src/pages/About.jsx` | `frontend/src/features/about/pages/AboutPage.jsx` |
| `pet-health-ai/src/pages/Auth.css` | `frontend/src/features/auth/styles/Auth.css` |
| `pet-health-ai/src/pages/Settings.css` | `frontend/src/features/settings/styles/Settings.css` |
| `pet-health-ai/src/pages/About.css` | `frontend/src/features/about/styles/About.css` |
| `pet-health-ai/src/CareAdvice.jsx` | `frontend/src/features/analysis/components/CareAdvice.jsx` |
| `pet-health-ai/src/OwnerContextForm.jsx` | `frontend/src/features/analysis/components/OwnerContextForm.jsx` |
| `pet-health-ai/src/OwnerContextSummary.jsx` | `frontend/src/features/analysis/components/OwnerContextSummary.jsx` |
| `pet-health-ai/src/OwnerContext.css` | `frontend/src/features/analysis/styles/OwnerContext.css` |
| `pet-health-ai/src/care-advice.js` | `frontend/src/features/analysis/services/care-advice.js` |
| `pet-health-ai/src/owner-context.js` | `frontend/src/features/analysis/utils/owner-context.js` |
| `pet-health-ai/src/owner-context.test.js` | `frontend/src/features/analysis/utils/owner-context.test.js` |
| `pet-health-ai/src/HistoryPhoto.jsx` | `frontend/src/features/history/components/HistoryPhoto.jsx` |
| `pet-health-ai/src/HealthSummaryChart.jsx` | `frontend/src/features/history/components/HealthSummaryChart.jsx` |
| `pet-health-ai/src/SymptomTracking.jsx` | `frontend/src/features/history/components/SymptomTracking.jsx` |
| `pet-health-ai/src/TrackingMatches.jsx` | `frontend/src/features/history/components/TrackingMatches.jsx` |
| `pet-health-ai/src/HealthSummaryChart.css` | `frontend/src/features/history/styles/HealthSummaryChart.css` |
| `pet-health-ai/src/SymptomTracking.css` | `frontend/src/features/history/styles/SymptomTracking.css` |
| `pet-health-ai/src/health-chart.js` | `frontend/src/features/history/utils/health-chart.js` |
| `pet-health-ai/src/tracking-chart.js` | `frontend/src/features/history/utils/tracking-chart.js` |
| `pet-health-ai/src/tracking-chart.test.js` | `frontend/src/features/history/utils/tracking-chart.test.js` |
| `pet-health-ai/src/auth-session.js` | `frontend/src/features/auth/services/auth-service.js + hooks/useAuth.js` |
| `pet-health-ai/src/health-store.js` | `frontend/src/features/history/services/history-service.js + hooks/useHistory.js; shared/hooks/useOwnedRows.js + services/owned-rows.js` |
| `pet-health-ai/src/pet-store.js` | `frontend/src/features/pets/services/pet-service.js + hooks/usePets.js + constants/default-pets.js` |
| `pet-health-ai/src/photo-storage.js` | `frontend/src/shared/services/photo-storage.js + hooks/usePhotoUrls.js` |
| `pet-health-ai/src/profile-avatars.js` | `frontend/src/features/auth/utils/profile-avatars.js` |
| `pet-health-ai/src/PhotoPicker.jsx` | `frontend/src/shared/components/ui/PhotoPicker.jsx` |
| `pet-health-ai/src/Dropdown.jsx` | `frontend/src/shared/components/ui/Dropdown.jsx` |
| `pet-health-ai/src/Dropdown.css` | `frontend/src/shared/components/ui/Dropdown.css` |
| `pet-health-ai/src/confidence.js` | `frontend/src/shared/utils/confidence.js` |
| `pet-health-ai/src/disease-labels.js` | `frontend/src/shared/constants/disease-labels.js` |
| `pet-health-ai/src/supabase.js` | `frontend/src/shared/lib/supabase.js` |
| `pet-health-ai/src/App.css` | `frontend/src/shared/styles/App.css` |
| `pet-health-ai/src/Themes.css` | `frontend/src/shared/styles/Themes.css` |
| `pet-health-ai/src/index.css` | `frontend/src/shared/styles/index.css` |
| `pet-health-ai/src/assets/hero.png` | `frontend/src/shared/assets/hero.png` |
| `pet-health-ai/src/assets/react.svg` | `frontend/src/shared/assets/react.svg` |
| `pet-health-ai/src/assets/vite.svg` | `frontend/src/shared/assets/vite.svg` |
| `pet-health-ai/src/main.jsx` | `frontend/src/main.jsx` |
| `pet-health-ai/src/shared.jsx` | `Split: shared/components/{layout,ui}, shared/{utils,constants}, features/home/data/demo.js` |
| `pet-health-ai/package.json` | `frontend/package.json` |
| `pet-health-ai/package-lock.json` | `frontend/package-lock.json` |
| `pet-health-ai/vite.config.js` | `frontend/vite.config.js` |
| `pet-health-ai/eslint.config.js` | `frontend/eslint.config.js` |
| `pet-health-ai/index.html` | `frontend/index.html` |

แยกเพิ่มจาก CheckPage: services/prediction-api.js และ components/AnalysisResult.jsx
แยกจาก ClinicsPage: config.js, utils/map.js, services/clinics-api.js และ components/ClinicMap.jsx
แยกจาก SettingsPage: features/pets/components/PetEditor.jsx และ DeletePetDialog.jsx
แยกจาก HistoryPage/HistoryPhoto: components/ResultBadge.jsx, utils/risk-text.js และ services/history-photo.js
shared.jsx แยกเป็น Header, Avatar, Risk, Disclaimer, PageHead, date.js, risk.js และ features/home/data/demo.js โดยคง named exports และแก้ผู้เรียกทั้งหมด

## ตาราง static assets

| เดิม | ใหม่ |
| --- | --- |
| `pet-health-ai/public/Happy Pet Care Paw Emblem.png` | `frontend/public/Happy Pet Care Paw Emblem.png` |
| `pet-health-ai/public/about/about-phone-check.webp` | `frontend/public/images/about/about-phone-check.webp` |
| `pet-health-ai/public/about/about-phone-settings.webp` | `frontend/public/images/about/about-phone-settings.webp` |
| `pet-health-ai/public/avatars/profile-1.png` | `frontend/public/images/avatars/profile-1.png` |
| `pet-health-ai/public/avatars/profile-2.png` | `frontend/public/images/avatars/profile-2.png` |
| `pet-health-ai/public/avatars/profile-3.png` | `frontend/public/images/avatars/profile-3.png` |
| `pet-health-ai/public/avatars/profile-4.png` | `frontend/public/images/avatars/profile-4.png` |
| `pet-health-ai/public/avatars/profile-red-bandana.png` | `frontend/public/images/avatars/profile-red-bandana.png` |
| `pet-health-ai/public/dogs/Buddy.png` | `frontend/public/images/pets/Buddy.png` |
| `pet-health-ai/public/dogs/Choco.png` | `frontend/public/images/pets/Choco.png` |
| `pet-health-ai/public/dogs/Dogประวัติ 1.jpg` | `frontend/public/dogs/Dogประวัติ 1.jpg` |
| `pet-health-ai/public/dogs/Golden-Retriever-PNG-File-Download-Free.png` | `frontend/public/images/home/Golden-Retriever-PNG-File-Download-Free.png` |
| `pet-health-ai/public/dogs/HumanLogo (1).png` | `frontend/public/images/avatars/profile-1.png` |
| `pet-health-ai/public/dogs/HumanLogo (2).png` | `frontend/public/images/avatars/profile-2.png` |
| `pet-health-ai/public/dogs/HumanLogo (3).png` | `frontend/public/images/avatars/profile-3.png` |
| `pet-health-ai/public/dogs/HumanLogo (4).png` | `frontend/public/images/avatars/profile-4.png` |
| `pet-health-ai/public/dogs/ImageDog_BG_blown.png` | `frontend/public/dogs/health-banner-mocha-ivory.png` |
| `pet-health-ai/public/dogs/Luna.png` | `frontend/public/images/pets/Luna.png` |
| `pet-health-ai/public/dogs/Milpo.png` | `frontend/public/images/pets/Milpo.png` |
| `pet-health-ai/public/dogs/about-dog.jpg` | `frontend/public/dogs/about-dog.jpg` |
| `pet-health-ai/public/dogs/buddy.jpg` | `frontend/public/dogs/buddy.jpg` |
| `pet-health-ai/public/dogs/cartoon-dog-cutout.png` | `frontend/public/dogs/cartoon-dog-cutout.png` |
| `pet-health-ai/public/dogs/check-banner-set-2.png` | `frontend/public/images/analysis/check-banner-set-2.png` |
| `pet-health-ai/public/dogs/choco.jpg` | `frontend/public/dogs/choco.jpg` |
| `pet-health-ai/public/dogs/clinic.png` | `frontend/public/images/clinics/clinic.png` |
| `pet-health-ai/public/dogs/doopet-navbar-symbol.png` | `frontend/public/images/branding/doopet-navbar-symbol.png` |
| `pet-health-ai/public/dogs/doopet-xml-logo-Photoroom.png` | `frontend/public/images/branding/doopet-xml-logo-Photoroom.png` |
| `pet-health-ai/public/dogs/garden-background.png` | `frontend/public/dogs/garden-background.png` |
| `pet-health-ai/public/dogs/golden-dog-cutout.png` | `frontend/public/images/about/golden-dog-cutout.png` |
| `pet-health-ai/public/dogs/health-banner-background.png` | `frontend/public/dogs/health-banner-background.png` |
| `pet-health-ai/public/dogs/health-banner-cartoon-morning.png` | `frontend/public/dogs/health-banner-cartoon-morning.png` |
| `pet-health-ai/public/dogs/health-banner-clean.png` | `frontend/public/dogs/health-banner-clean.png` |
| `pet-health-ai/public/dogs/health-banner-dog-gang-clean.png` | `frontend/public/images/analysis/health-banner-dog-gang-clean.png` |
| `pet-health-ai/public/dogs/health-banner-dog-gang-v2.png` | `frontend/public/dogs/health-banner-dog-gang-v2.png` |
| `pet-health-ai/public/dogs/health-banner-emerald.png` | `frontend/public/dogs/health-banner-emerald.png` |
| `pet-health-ai/public/dogs/health-banner-grass.png` | `frontend/public/dogs/health-banner-grass.png` |
| `pet-health-ai/public/dogs/health-banner-mocha-ivory.png` | `frontend/public/dogs/health-banner-mocha-ivory.png` |
| `pet-health-ai/public/dogs/health-banner-puppy.png` | `frontend/public/dogs/health-banner-puppy.png` |
| `pet-health-ai/public/dogs/health-banner-studio.png` | `frontend/public/dogs/health-banner-studio.png` |
| `pet-health-ai/public/dogs/health-banner-warm-garden.png` | `frontend/public/dogs/health-banner-warm-garden.png` |
| `pet-health-ai/public/dogs/hero-golden-v2.jpg` | `frontend/public/dogs/hero-golden-v2.jpg` |
| `pet-health-ai/public/dogs/hero-golden.jpg` | `frontend/public/dogs/buddy.jpg` |
| `pet-health-ai/public/dogs/login-dog-portrait.png` | `frontend/public/images/auth/login-dog-portrait.png` |
| `pet-health-ai/public/dogs/luna.jpg` | `frontend/public/dogs/luna.jpg` |
| `pet-health-ai/public/dogs/milo.jpg` | `frontend/public/dogs/milo.jpg` |
| `pet-health-ai/public/dogs/puppy-running-cutout.png` | `frontend/public/dogs/puppy-running-cutout.png` |
| `pet-health-ai/public/dogs/signup-dog-camp.png` | `frontend/public/dogs/signup-dog-camp.png` |
| `pet-health-ai/public/dogs/ตรวจสุขภาพสัตว์เลี้ยงด้วย AI_banner.png` | `frontend/public/images/analysis/check-banner-set-2.png` |
| `pet-health-ai/public/favicon.svg` | `frontend/public/favicon.svg` |
| `pet-health-ai/public/icons.svg` | `frontend/public/icons.svg` |

## ตัวเลือกตรวจสอบที่ยังเก็บไว้

- features/home/pages/HomePage.jsx: ไม่มี route/import ใน runtime เดิมและใหม่ เก็บไว้และตรวจด้วย SSR smoke แยก
- features/home/data/demo.js: PETS/HISTORY/CLINICS/ADVICE ตัวอย่างที่ไม่มีผู้เรียกหลังนำ unused imports เดิมออก ไม่ผสมกับข้อมูลจริง
- shared/components/ui/PageHead.jsx: named export เดิมที่ไม่พบผู้เรียก เก็บไว้
- shared/assets/hero.png, react.svg, vite.svg: ไม่พบ import เก็บไว้ครบ
- static assets ด้านล่างไม่พบ literal URL เต็มใน source ปัจจุบัน เป็นเพียงผู้สมัครตรวจสอบ อาจมี URL จากข้อมูลเก่า/ภายนอกหรือการประกอบ dynamic จึงห้ามสรุปว่าไม่มีการใช้งานจริง

- `frontend/public/dogs/about-dog.jpg`
- `frontend/public/dogs/buddy.jpg`
- `frontend/public/dogs/Buddy.png`
- `frontend/public/dogs/cartoon-dog-cutout.png`
- `frontend/public/dogs/choco.jpg`
- `frontend/public/dogs/Choco.png`
- `frontend/public/dogs/Dogประวัติ 1.jpg`
- `frontend/public/dogs/garden-background.png`
- `frontend/public/dogs/health-banner-background.png`
- `frontend/public/dogs/health-banner-cartoon-morning.png`
- `frontend/public/dogs/health-banner-clean.png`
- `frontend/public/dogs/health-banner-dog-gang-v2.png`
- `frontend/public/dogs/health-banner-emerald.png`
- `frontend/public/dogs/health-banner-grass.png`
- `frontend/public/dogs/health-banner-mocha-ivory.png`
- `frontend/public/dogs/health-banner-puppy.png`
- `frontend/public/dogs/health-banner-studio.png`
- `frontend/public/dogs/health-banner-warm-garden.png`
- `frontend/public/dogs/hero-golden-v2.jpg`
- `frontend/public/dogs/hero-golden.jpg`
- `frontend/public/dogs/HumanLogo (1).png`
- `frontend/public/dogs/HumanLogo (2).png`
- `frontend/public/dogs/HumanLogo (3).png`
- `frontend/public/dogs/HumanLogo (4).png`
- `frontend/public/dogs/ImageDog_BG_blown.png`
- `frontend/public/dogs/luna.jpg`
- `frontend/public/dogs/Luna.png`
- `frontend/public/dogs/milo.jpg`
- `frontend/public/dogs/Milpo.png`
- `frontend/public/dogs/puppy-running-cutout.png`
- `frontend/public/dogs/signup-dog-camp.png`
- `frontend/public/dogs/ตรวจสุขภาพสัตว์เลี้ยงด้วย AI_banner.png`
- `frontend/public/Happy Pet Care Paw Emblem.png`
- `frontend/public/icons.svg`

การสแกนไม่ได้อ่านข้อมูลส่วนตัวใน Supabase, browser cache หรือประวัติ deployment และไม่ลบไฟล์ตามผลสแกน

## วิธีเพิ่มงาน

1. หน้าใหม่: สร้าง features/<feature>/pages/<Name>Page.jsx แล้ว import/เพิ่ม Route ใน app/routes.jsx คงรูปแบบ HashRouter และตรวจ access rules
2. Component ใหม่: วางใน features/<feature>/components/ หากข้ามหลายฟีเจอร์จริงจึงใช้ shared/components/ui หรือ layout อย่า import utility จาก Page
3. API ใหม่: วางใน services ของเจ้าของฟีเจอร์ ใช้ apiBase จาก shared/config/api.js; เก็บ pure transformation ใน utils และ lifecycle/cleanup ใน hooks
4. CSS ใหม่: วางใน styles ของฟีเจอร์หรือคู่ component ตรวจลำดับ cascade และ responsive; อย่าแยก global override โดยไม่ตรวจภาพก่อน
5. Asset ใหม่: วางตามหมวด public/images/ และแก้ literal/dynamic references ทั้งหมด ห้ามย้าย URL ที่มีอยู่ในข้อมูลจริงโดยไม่มี compatibility

## คำสั่งและผลตรวจ (26 พฤศจิกายน 2026)

จาก frontend/:

```powershell
npm ci
npm run dev
npm run build
npm run lint
node --test src/features/analysis/utils/owner-context.test.js src/features/history/utils/tracking-chart.test.js src/features/analysis/services/prediction-api.test.js
node scripts/smoke-render.mjs
node scripts/check-structure.mjs
```

| ตรวจ | ก่อน | หลัง |
| --- | --- | --- |
| Vite Build | ผ่าน | ผ่าน; warning chunk >500 kB เดิมยังมี |
| JS tests | 20 ผ่าน | 23 ผ่าน (เพิ่ม 3 prediction contract tests โดย mock fetch) |
| ESLint | 29 errors: unused imports ใน Home/Auth และ mixed exports ใน shared.jsx | ไม่มี errors ผ่าน node node_modules/eslint/bin/eslint.js . |
| SSR smoke | ไม่ได้รัน | ผ่าน 11 render cases: check/history/clinics/about/login/signup, Home แยก, Settings guest, และ Settings/History/Check ด้วย local account fixture |
| Legacy assets | URL เดิม | รูปโปรไฟล์และสัตว์เลี้ยงที่บันทึก URL เก่ายังแสดงเป็น selected โดยไม่ย้ายข้อมูลจริง |
| CSS | baseline เก็บไว้ | bundle ตรงกัน byte-for-byte |
| Config/dependencies | baseline Git | package.json, package-lock.json, vite.config.js, eslint.config.js, index.html เนื้อหาตรงกัน (ปรับ EOL ก่อนเทียบ Git) |
| Backend/database | เดิม | source/weights/database ไม่เปลี่ยน แก้ model/README.th.md เฉพาะคำสั่งเปิด Frontend |

npm run lint ใน sandbox ติด EPERM ที่ C:/Users/thana จึงเรียก ESLint binary ผ่าน node โดยตรง (ใช้ config/rules เดียวกัน ไม่ลดกฎ)
SSR test แทน useAuth เฉพาะ test server เพราะ hook เดิมไม่มี getServerSnapshot; ไม่เปลี่ยน production hook เพื่อรองรับ SSR
SSR ไม่รัน effects หรือทดแทน browser navigation/refresh/focus/session tests

ข้อจำกัด: agent-browser CLI ไม่ติดตั้ง, Browser host ใช้งานไม่ได้, Chrome ที่พบย่ออยู่และ CUA อ่านไม่ได้ จึงยังไม่ได้ยืนยันภาพ Desktop/Mobile, animation, navigation และ refresh ใน Browser จริง
Backend GET /models ถูกปฏิเสธ ECONNREFUSED จึงยังไม่ได้ทดสอบ live inference, care advice, login/logout/reset, Storage หรือ CRUD จริง
ไม่ได้สร้างหรือลบข้อมูลจริง ไม่เรียก /learn และไม่รัน SQL
อ่านแผน Backend ใน [backend-restructure-plan.md](backend-restructure-plan.md)
