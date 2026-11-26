-- 010: ข้อมูลประกอบการตรวจ (ไม่บังคับ) — owner_context
-- วิธีใช้: เปิด Supabase → SQL Editor แล้วรันไฟล์นี้ทั้งไฟล์ (รันซ้ำได้)
--
-- อ้างอิงนิยามจริงจากฐานข้อมูล (ตรวจเมื่อ 22 พ.ย. 2569):
--   - save_doo_pet_analysis_with_advice(uuid, jsonb, jsonb, text, text, jsonb) SECURITY DEFINER, search_path ''
--     owner postgres, EXECUTE: postgres, authenticated, service_role
--   - view doo_pet_history: security_invoker=true, owner postgres
--   - analyses.owner_context jsonb มีอยู่แล้ว
--
-- สิ่งที่เปลี่ยน:
--   1) เพิ่มฟังก์ชันตรวจรูปแบบ owner_context
--   2) RPC รับ p_owner_context เพิ่ม (ค่าเริ่มต้น null) client เดิมเรียกได้เหมือนเดิม
--      และเก็บ care_advice.context_tips ได้ ทุกอย่างอยู่ใน transaction เดียวกับการบันทึกผลตรวจ
--      คงเจ้าของและสิทธิ์ EXECUTE เดิม
--   3) view doo_pet_history เพิ่มคอลัมน์ owner_context ต่อท้าย คอลัมน์เดิม สิทธิ์ และ security_invoker คงเดิม
-- ไม่แตะคะแนนโมเดล ผลจำแนก หรือระดับความมั่นใจ

begin;

-- ---------------------------------------------------------------------------
-- 1) ตรวจรูปแบบ owner_context ให้ตรงกับ frontend/backend (model/owner_context.py)
--    คืน true เมื่อเป็น null หรือถูกต้อง
-- ---------------------------------------------------------------------------
create or replace function public.doo_pet_valid_owner_context(p jsonb)
returns boolean
language plpgsql
immutable
set search_path to ''
as $fn$
declare
  k text;
  arr jsonb;
  allowed text[];
  exclusive text[];
  vals text[];
begin
  if p is null then return true; end if;
  if jsonb_typeof(p) <> 'object' then return false; end if;
  for k in select jsonb_object_keys(p) loop
    if k not in ('version', 'symptoms', 'duration', 'body_sites', 'living_environment', 'recent_changes', 'notes') then return false; end if;
  end loop;
  if (p->'version') is distinct from '1'::jsonb then return false; end if;

  -- คำถามแบบเลือกได้หลายข้อ: ค่าที่อนุญาต และตัวเลือกที่ต้องเลือกเดี่ยว
  foreach k in array array['symptoms', 'body_sites', 'recent_changes'] loop
    arr := p->k;
    continue when arr is null;
    if jsonb_typeof(arr) <> 'array' or jsonb_array_length(arr) = 0 then return false; end if;
    if exists (select 1 from jsonb_array_elements(arr) e where jsonb_typeof(e) <> 'string') then return false; end if;
    select array_agg(distinct e) into vals from jsonb_array_elements_text(arr) e;
    allowed := case k
      when 'symptoms' then array['itching', 'licking_scratching', 'hair_loss', 'redness', 'unsure']
      when 'body_sites' then array['face', 'ears', 'body', 'abdomen', 'legs_paws', 'multiple']
      else array['food', 'shampoo', 'bedding', 'play_area', 'none', 'unknown'] end;
    exclusive := case k when 'symptoms' then array['unsure'] when 'body_sites' then array['multiple'] else array['none', 'unknown'] end;
    if not vals <@ allowed then return false; end if;
    if vals && exclusive and cardinality(vals) > 1 then return false; end if;
  end loop;

  -- คำถามแบบเลือกข้อเดียว
  if p ? 'duration' and (jsonb_typeof(p->'duration') <> 'string'
      or p->>'duration' not in ('today', '2_3_days', 'about_1_week', 'longer', 'unknown')) then return false; end if;
  if p ? 'living_environment' and (jsonb_typeof(p->'living_environment') <> 'string'
      or p->>'living_environment' not in ('indoor', 'outdoor', 'both', 'unknown')) then return false; end if;

  -- บันทึกเพิ่มเติม: ข้อความไม่ว่าง ไม่เกิน 500 ตัวอักษร
  if p ? 'notes' and (jsonb_typeof(p->'notes') <> 'string' or char_length(trim(p->>'notes')) not between 1 and 500) then return false; end if;

  -- ต้องมีอย่างน้อย 1 คำตอบ (ถ้าไม่กรอกอะไรเลย ให้ส่ง null แทน)
  return exists (select 1 from jsonb_object_keys(p) key where key <> 'version');
end $fn$;

-- ---------------------------------------------------------------------------
-- 2) RPC บันทึกผลตรวจ: เพิ่ม p_owner_context (ไม่บังคับ, ค่าเริ่มต้น null)
--    - client เดิมที่ส่ง 6 พารามิเตอร์ยังเรียกได้เหมือนเดิม
--    - ตรวจและบันทึก owner_context + care_advice (รวม context_tips) ใน transaction เดียวกับผลตรวจ
--    - คงสิทธิ์ EXECUTE และเจ้าของฟังก์ชันเดิมทุกประการ (คัดลอกจากฟังก์ชันเดิมก่อนแทนที่)
-- ---------------------------------------------------------------------------
create temporary table doo_pet_old_fn on commit drop as
select p.proacl, p.proowner::regrole::text as owner
from pg_proc p
where p.oid = coalesce(
  to_regprocedure('public.save_doo_pet_analysis_with_advice(uuid, jsonb, jsonb, text, text, jsonb)'),
  to_regprocedure('public.save_doo_pet_analysis_with_advice(uuid, jsonb, jsonb, text, text, jsonb, jsonb)'));

do $$ begin
  if not exists (select 1 from doo_pet_old_fn) then
    raise exception 'ไม่พบฟังก์ชัน save_doo_pet_analysis_with_advice เดิม หยุดการทำงานโดยไม่แก้อะไร';
  end if;
end $$;

drop function if exists public.save_doo_pet_analysis_with_advice(uuid, jsonb, jsonb, text, text, jsonb);
drop function if exists public.save_doo_pet_analysis_with_advice(uuid, jsonb, jsonb, text, text, jsonb, jsonb);

create function public.save_doo_pet_analysis_with_advice(
  p_pet uuid, p_image jsonb, p_runs jsonb, p_selected text, p_risk text, p_care_advice jsonb,
  p_owner_context jsonb default null
)
 returns bigint
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  saved_id bigint;
  tips jsonb := p_care_advice->'context_tips';
  context jsonb := nullif(p_owner_context, 'null'::jsonb);
begin
  -- ตรวจคำแนะนำทั่วไป (เหมือนเดิม)
  if jsonb_typeof(p_care_advice) is distinct from 'object'
     or coalesce(p_care_advice->>'source','') not in ('gemini','fallback')
     or jsonb_typeof(p_care_advice->'items') is distinct from 'array' then
    raise exception 'Invalid care advice';
  end if;
  if jsonb_array_length(p_care_advice->'items') <> 3 or exists (
    select 1 from jsonb_array_elements(p_care_advice->'items') item
    where jsonb_typeof(item) <> 'string'
       or char_length(trim(item #>> '{}')) not between 1 and 500
  ) then
    raise exception 'Invalid care advice items';
  end if;

  -- ตรวจคำแนะนำจากข้อมูลเจ้าของ (มีได้เฉพาะเมื่อส่ง owner_context มา)
  if tips is not null and tips <> 'null'::jsonb then
    if context is null
       or jsonb_typeof(tips) <> 'object'
       or coalesce(tips->>'source','') not in ('gemini','fallback')
       or jsonb_typeof(tips->'items') is distinct from 'array'
       or jsonb_array_length(tips->'items') not between 1 and 3
       or exists (select 1 from jsonb_array_elements(tips->'items') item
                  where jsonb_typeof(item) <> 'string' or char_length(trim(item #>> '{}')) not between 1 and 220) then
      raise exception 'Invalid context tips';
    end if;
  else
    tips := null;
  end if;

  -- ตรวจข้อมูลประกอบการตรวจ
  if not public.doo_pet_valid_owner_context(context) then
    raise exception 'Invalid owner context';
  end if;

  saved_id := public.save_doo_pet_analysis(p_pet, p_image, p_runs, p_selected, p_risk);
  update public.analyses
  set care_advice = jsonb_build_object('source', p_care_advice->>'source', 'items', p_care_advice->'items')
                    || case when tips is null then '{}'::jsonb
                            else jsonb_build_object('context_tips', jsonb_build_object('source', tips->>'source', 'items', tips->'items')) end,
      owner_context = context
  where id = saved_id and requested_by = auth.uid();
  if not found then raise exception 'Analysis owner mismatch'; end if;
  return saved_id;
end $function$;

-- คืนเจ้าของและสิทธิ์ EXECUTE ให้เหมือนฟังก์ชันเดิม
do $$
declare
  old record;
  entry record;
  fn regprocedure := 'public.save_doo_pet_analysis_with_advice(uuid, jsonb, jsonb, text, text, jsonb, jsonb)'::regprocedure;
begin
  select * into old from doo_pet_old_fn;
  execute format('alter function %s owner to %I', fn, old.owner);
  execute format('revoke all on function %s from public', fn);
  for entry in select grantee from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a(grantor, grantee, privilege_type, is_grantable)
               where p.oid = fn and a.grantee <> 0 loop
    execute format('revoke all on function %s from %I', fn, entry.grantee::regrole::text);
  end loop;
  for entry in select a.grantee from aclexplode(coalesce(old.proacl, acldefault('f', (select oid from pg_roles where rolname = old.owner)))) a(grantor, grantee, privilege_type, is_grantable)
               where a.privilege_type = 'EXECUTE' loop
    if entry.grantee = 0 then
      execute format('grant execute on function %s to public', fn);
    else
      execute format('grant execute on function %s to %I', fn, entry.grantee::regrole::text);
    end if;
  end loop;
end $$;

revoke all on function public.doo_pet_valid_owner_context(jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) view ประวัติ: นิยามเดิมทุกคอลัมน์ + owner_context ต่อท้าย
--    CREATE OR REPLACE คงสิทธิ์ (GRANT) เดิม และระบุ security_invoker=true ซ้ำเพื่อให้ RLS ของผู้เรียกยังมีผล
-- ---------------------------------------------------------------------------
create or replace view public.doo_pet_history with (security_invoker = true) as
 SELECT h.id, h.owner_id, h.pet, h.date, h.disease, h.risk, h.score, h.analysis_id, a.care_advice, a.owner_context
   FROM ( SELECT a_1.id::text AS id, a_1.requested_by AS owner_id, i.pet_id AS pet, a_1.completed_at AS date,
                 c.name_en AS disease, a_1.risk, t.score::double precision AS score, a_1.id AS analysis_id
            FROM public.analyses a_1
              JOIN public.skin_images i ON i.id = a_1.image_id
              JOIN public.prediction_top_results t ON t.analysis_id = a_1.id AND t.is_selected
              JOIN public.disease_classes c ON c.code = t.class_code) h
     LEFT JOIN public.analyses a ON a.id = h.analysis_id AND a.requested_by = h.owner_id;

commit;

-- ตรวจผล:
-- select oid::regprocedure, proacl from pg_proc where proname = 'save_doo_pet_analysis_with_advice';
-- select reloptions from pg_class where oid = 'public.doo_pet_history'::regclass;   -- {security_invoker=true}
-- select id, owner_context from public.doo_pet_history limit 5;
