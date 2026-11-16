-- Run after 004. Replace the email with an existing Supabase Auth account.
-- Sample results only. The seed paths are markers and have no uploaded files.
begin;

do $$
declare
  test_email constant text := 'CHANGE_ME@example.com';
  account uuid;
  animal uuid;
  model_id bigint;
  image_id bigint;
  check_id bigint;
  prediction bigint;
  sample record;
  checked_at timestamptz;
  labels text[] := array['bacterial_dermatosis','demodicosis','dermatitis',
    'fungal_infection','healthy','hypersensitivity'];
begin
  select u.id into account from auth.users u
    join public.users p on p.id=u.id where lower(u.email)=lower(trim(test_email));
  if account is null then
    raise exception 'Set test_email to an existing app account before running this file';
  end if;

  animal := md5(account::text || ':doo-pet-seed-v1')::uuid;
  insert into public.pets(id,owner_id,name,breed,sex,age,img)
    values (animal,account,'[TEST] Buddy','Golden Retriever','ผู้',3,'/dogs/Buddy.png')
    on conflict (id) do nothing;

  insert into public.model_versions(owner_id,model_name,version,weights_storage_key,
    weights_sha256,preprocessing_version,is_finetuned,metrics)
    values(account,'[TEST] Sample model','seed-v1','seed/no-checkpoint',repeat('0',64),
      'seed-v1',false,'{"synthetic":true}')
    on conflict(owner_id,model_name,version) do nothing;
  select id into strict model_id from public.model_versions
    where owner_id=account and model_name='[TEST] Sample model' and version='seed-v1';
  insert into public.model_version_classes(model_version_id,class_code,output_index)
    select model_id,label,(position-1)::smallint from unnest(labels) with ordinality as l(label,position)
    on conflict(model_version_id,class_code) do nothing;

  for sample in select * from (values
    ('healthy','low',0.95,1), ('fungal_infection','mid',0.60,3),
    ('dermatitis','high',0.80,7)
  ) as s(label,risk,score,days_ago) loop
    checked_at := now() - make_interval(days => sample.days_ago);
    insert into public.skin_images(pet_id,uploaded_by,storage_key,original_filename,mime_type,
      size_bytes,sha256,created_at)
    values(animal,account,account::text || '/seed-v1/' || sample.label,
      'seed-placeholder.jpg','image/jpeg',1,repeat('0',64),checked_at)
    on conflict(storage_key) do nothing returning id into image_id;
    if image_id is null then continue; end if;

    insert into public.analyses(image_id,requested_by,status,guardrail_passed,risk,symptoms,created_at,completed_at)
    values(image_id,account,'completed',true,sample.risk,'[TEST] ข้อมูลสมมติ',checked_at,checked_at)
    returning id into check_id;

    insert into public.predictions(analysis_id,model_version_id,is_selected)
    values(check_id,model_id,true) returning id into prediction;

    insert into public.prediction_scores(prediction_id,model_version_id,class_code,score)
    select prediction,model_id,label,
      case when label=sample.label then sample.score else (1-sample.score)/5 end
    from unnest(labels) as l(label);
  end loop;
end $$;

commit;
