-- 008: เปิดให้เจ้าของที่เข้าสู่ระบบลบสัตว์เลี้ยงของตัวเองได้ (หน้า My pet → ลบสัตว์เลี้ยง)
-- แก้ปัญหา: "permission denied for table pets" (role authenticated ยังไม่มีสิทธิ์ DELETE)
-- วิธีใช้: เปิด Supabase → SQL Editor แล้วรันไฟล์นี้ครั้งเดียว (รันซ้ำได้ ไม่เสียหาย)

do $$
begin
  -- ป้องกันไว้ก่อน: ถ้าตาราง pets ยังไม่เปิด RLS จะไม่ให้สิทธิ์ลบ
  -- เพราะผู้ใช้คนใดก็ได้จะลบสัตว์เลี้ยงของคนอื่นได้
  if not (select relrowsecurity from pg_class where oid = 'public.pets'::regclass) then
    raise exception 'ตาราง public.pets ยังไม่เปิด RLS กรุณาเปิด RLS และเพิ่ม policy สำหรับ select/insert/update ก่อน แล้วค่อยรันไฟล์นี้อีกครั้ง';
  end if;
end $$;

-- ให้สิทธิ์ลบแก่ผู้ใช้ที่เข้าสู่ระบบ
grant delete on table public.pets to authenticated;

-- อนุญาตให้ลบได้เฉพาะสัตว์เลี้ยงในบัญชีของตัวเอง
drop policy if exists pets_delete_own on public.pets;
create policy pets_delete_own on public.pets
  for delete to authenticated
  using (owner_id::text = auth.uid()::text);

-- ตรวจผล (ควรเห็น pets_delete_own และ cmd = DELETE):
-- select policyname, cmd, roles from pg_policies where schemaname = 'public' and tablename = 'pets';
