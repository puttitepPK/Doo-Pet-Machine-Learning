begin;
set local search_path to public;

alter table public.analyses add column if not exists care_advice jsonb;

-- Keep the current history query, including legacy rows if 006 was skipped.
do $$
declare
  old_query text;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'doo_pet_history' and column_name = 'care_advice'
  ) then
    old_query := rtrim(pg_get_viewdef('public.doo_pet_history'::regclass), E'; \n\r\t');
    execute format(
      'create or replace view public.doo_pet_history with (security_invoker=true) as
       select h.*, a.care_advice from (%s) h
       left join public.analyses a on a.id = h.analysis_id and a.requested_by = h.owner_id',
      old_query
    );
  end if;
end $$;

create or replace function public.save_doo_pet_analysis_with_advice(
  p_pet uuid, p_image jsonb, p_runs jsonb, p_selected text, p_risk text, p_care_advice jsonb
) returns bigint language plpgsql security definer set search_path = '' as $$
declare
  saved_id bigint;
begin
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

  saved_id := public.save_doo_pet_analysis(p_pet, p_image, p_runs, p_selected, p_risk);
  update public.analyses
  set care_advice = jsonb_build_object('source', p_care_advice->>'source', 'items', p_care_advice->'items')
  where id = saved_id and requested_by = auth.uid();
  if not found then raise exception 'Analysis owner mismatch'; end if;
  return saved_id;
end $$;

revoke all on function public.save_doo_pet_analysis_with_advice(uuid,jsonb,jsonb,text,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.save_doo_pet_analysis_with_advice(uuid,jsonb,jsonb,text,text,jsonb)
  to authenticated;

commit;
