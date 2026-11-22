-- 009: ลบสัตว์เลี้ยงพร้อมประวัติการตรวจทั้งหมดแบบถาวร (หน้า My pet → ลบสัตว์เลี้ยง)
-- วิธีใช้: เปิด Supabase → SQL Editor แล้วรันไฟล์นี้ (รันซ้ำได้)
--
-- ทำงานในคำสั่งเดียว (transaction เดียว): ถ้าขั้นไหนผิดพลาด จะยกเลิกทั้งหมด ข้อมูลไม่หายครึ่ง ๆ กลาง ๆ
-- ลำดับการลบ (จากข้อมูลลูกไปหาข้อมูลแม่ เพื่อไม่ให้ชน foreign key):
--   คะแนนผลโมเดล → ผลโมเดล → ข้อมูลที่ผูกกับการวิเคราะห์ → การวิเคราะห์ → รูปผิวหนัง → ตัวสัตว์เลี้ยง
-- ฟังก์ชันคืนรายชื่อไฟล์รูปใน Storage ให้หน้าเว็บลบต่อ

-- ลบแถวในตารางลูกทุกตารางที่อ้างอิงตารางแม่ด้วย foreign key คอลัมน์เดียว
-- (ครอบคลุมตารางเสริม เช่น คำแนะนำการดูแล หรือ feedback ที่ไม่ได้อยู่ในไฟล์ schema นี้)
create or replace function public.doo_pet_delete_children(p_parent regclass, p_ids text[], p_skip regclass[] default '{}')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  fk record;
begin
  if p_ids is null or cardinality(p_ids) = 0 then return; end if;
  for fk in
    select c.conrelid::regclass as child, a.attname as col
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.confrelid = p_parent and cardinality(c.conkey) = 1
      and not (c.conrelid::regclass = any(p_skip))
  loop
    execute format('delete from %s where %I::text = any($1)', fk.child, fk.col) using p_ids;
  end loop;
end $$;

create or replace function public.delete_doo_pet(p_pet text)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_images text[];
  v_keys text[];
  v_analyses text[];
  v_predictions text[];
  v_history regclass := to_regclass('public.doo_pet_history');
begin
  if auth.uid() is null then
    raise exception 'ต้องเข้าสู่ระบบก่อน' using errcode = '42501';
  end if;
  -- ลบได้เฉพาะสัตว์เลี้ยงของบัญชีที่เข้าสู่ระบบอยู่
  perform 1 from pets where id::text = p_pet and owner_id::text = auth.uid()::text for update;
  if not found then
    raise exception 'ไม่พบสัตว์เลี้ยงตัวนี้ในบัญชีของคุณ' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(id::text), '{}'), coalesce(array_agg(storage_key) filter (where storage_key is not null), '{}')
    into v_images, v_keys
    from skin_images where pet_id::text = p_pet;
  select coalesce(array_agg(id::text), '{}') into v_analyses
    from analyses where image_id::text = any(v_images);

  if to_regclass('public.predictions') is not null then
    select coalesce(array_agg(id::text), '{}') into v_predictions
      from predictions where analysis_id::text = any(v_analyses);
    if to_regclass('public.prediction_scores') is not null then
      delete from prediction_scores where prediction_id::text = any(v_predictions);
    end if;
    perform doo_pet_delete_children('public.predictions', v_predictions);
    delete from predictions where id::text = any(v_predictions);
  end if;

  perform doo_pet_delete_children('public.analyses', v_analyses);
  delete from analyses where id::text = any(v_analyses);

  perform doo_pet_delete_children('public.skin_images', v_images);
  delete from skin_images where id::text = any(v_images);

  -- ถ้า doo_pet_history เป็นตารางจริง (ไม่ใช่ view) และมีคอลัมน์ pet ให้ลบของน้องตัวนี้ด้วย
  if v_history is not null
     and (select relkind from pg_class where oid = v_history) in ('r', 'p')
     and exists (select 1 from pg_attribute where attrelid = v_history and attname = 'pet' and not attisdropped) then
    execute format('delete from %s where pet::text = $1', v_history) using p_pet;
  end if;

  perform doo_pet_delete_children('public.pets', array[p_pet]);
  delete from pets where id::text = p_pet;

  return v_keys;
end $$;

-- ให้เรียกได้เฉพาะผู้ใช้ที่เข้าสู่ระบบ ฟังก์ชันตัวช่วยห้ามเรียกตรง
revoke all on function public.doo_pet_delete_children(regclass, text[], regclass[]) from public, anon, authenticated;
revoke all on function public.delete_doo_pet(text) from public, anon;
grant execute on function public.delete_doo_pet(text) to authenticated;
