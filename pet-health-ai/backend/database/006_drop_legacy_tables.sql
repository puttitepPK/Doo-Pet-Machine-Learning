begin;

do $$
declare
  legacy regclass;
  missing boolean;
begin
  foreach legacy in array array[to_regclass('public.doo_pet_pets'), to_regclass('doo_pet_archive.doo_pet_pets')] loop
    if legacy is null then continue; end if;
    execute format('select exists (select 1 from %s old where not exists
      (select 1 from public.pets p where p.id = old.id and p.owner_id = old.owner_id))', legacy)
      into missing;
    if missing then raise exception 'Some legacy pets are missing from public.pets'; end if;
  end loop;
end $$;

create or replace view public.doo_pet_history with (security_invoker=true) as
select a.id::text id, a.requested_by owner_id,i.pet_id pet,a.completed_at date,
  c.name_en disease,a.risk,t.score::double precision score,a.id analysis_id
from public.analyses a
join public.skin_images i on i.id=a.image_id
join public.prediction_top_results t on t.analysis_id=a.id and t.is_selected
join public.disease_classes c on c.code=t.class_code;

grant select on public.doo_pet_history to authenticated;

drop table if exists public.doo_pet_checks;
drop table if exists public.doo_pet_pets;
drop table if exists doo_pet_archive.doo_pet_checks;
drop table if exists doo_pet_archive.doo_pet_pets;

commit;
