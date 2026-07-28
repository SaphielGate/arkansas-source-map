create table public.csv_import_batches (
  id uuid primary key default extensions.gen_random_uuid(),
  original_filename text not null
    check (length(original_filename) between 1 and 255),
  file_sha256 text not null unique
    check (file_sha256 ~ '^[a-f0-9]{64}$'),
  imported_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'processing'
    check (status in ('processing', 'completed', 'failed')),
  total_rows integer not null check (total_rows between 1 and 1000),
  valid_rows integer not null default 0 check (valid_rows >= 0),
  inserted_rows integer not null default 0 check (inserted_rows >= 0),
  duplicate_rows integer not null default 0 check (duplicate_rows >= 0),
  rejected_rows integer not null default 0 check (rejected_rows >= 0),
  error_summary jsonb not null default '[]'::jsonb
    check (jsonb_typeof(error_summary) = 'array'),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  check (
    (status = 'processing' and completed_at is null)
    or (status in ('completed', 'failed') and completed_at is not null)
  ),
  check (valid_rows + duplicate_rows + rejected_rows = total_rows),
  check (inserted_rows <= valid_rows)
);

comment on table public.csv_import_batches is
  'Immutable CSV import provenance and outcome totals. This is an audit log, not a review queue.';

alter table public.source_observations
  alter column location_record_id drop not null,
  alter column source_url drop not null,
  alter column address drop not null,
  alter column city drop not null,
  alter column zip_code drop not null,
  add column source_name text,
  add column incident_type text,
  add column summary text,
  add column external_id text,
  add column import_batch_id uuid references public.csv_import_batches(id) on delete restrict,
  add column original_csv_row_number integer,
  add column original_payload jsonb,
  add column normalization_log jsonb,
  add column import_dedup_key text,
  add column imported_at timestamptz;

alter table public.source_observations
  add constraint source_observations_import_provenance_check check (
    import_batch_id is null
    or (
      source_name is not null
      and length(trim(source_name)) between 1 and 200
      and incident_type is not null
      and length(trim(incident_type)) between 1 and 200
      and summary is not null
      and length(trim(summary)) between 1 and 5000
      and length(county) between 1 and 200
      and (city is null or length(city) <= 200)
      and (source_url is null or length(source_url) <= 2048)
      and (external_id is null or length(external_id) <= 200)
      and (address is null or length(address) <= 500)
      and (analyst_notes is null or length(analyst_notes) <= 5000)
      and original_csv_row_number >= 2
      and jsonb_typeof(original_payload) = 'object'
      and jsonb_typeof(normalization_log) = 'array'
      and import_dedup_key ~ '^[a-f0-9]{64}$'
      and imported_at is not null
    )
  );

-- A non-partial unique constraint allows PostgREST's on_conflict parameter to
-- enforce idempotency. PostgreSQL permits multiple nulls for manual rows.
alter table public.source_observations
  add constraint source_observations_import_dedup_key_key
  unique (import_dedup_key);
create index source_observations_import_batch_idx
  on public.source_observations(import_batch_id, original_csv_row_number)
  where import_batch_id is not null;
create index source_observations_external_id_idx
  on public.source_observations(external_id)
  where external_id is not null;

create table public.csv_import_rows (
  id uuid primary key default extensions.gen_random_uuid(),
  import_batch_id uuid not null references public.csv_import_batches(id) on delete restrict,
  csv_row_number integer not null check (csv_row_number >= 2),
  outcome text not null check (outcome in ('valid', 'invalid', 'duplicate')),
  duplicate_reason text
    check (duplicate_reason is null or duplicate_reason in ('within_file', 'existing_database')),
  validation_errors jsonb not null default '[]'::jsonb
    check (jsonb_typeof(validation_errors) = 'array'),
  original_payload jsonb not null
    check (jsonb_typeof(original_payload) = 'object'),
  normalized_payload jsonb
    check (normalized_payload is null or jsonb_typeof(normalized_payload) = 'object'),
  normalization_log jsonb not null default '[]'::jsonb
    check (jsonb_typeof(normalization_log) = 'array'),
  dedup_key text check (dedup_key is null or dedup_key ~ '^[a-f0-9]{64}$'),
  observation_id uuid references public.source_observations(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (import_batch_id, csv_row_number),
  check (
    (outcome = 'valid' and duplicate_reason is null)
    or (outcome = 'invalid' and duplicate_reason is null and observation_id is null)
    or (outcome = 'duplicate' and duplicate_reason is not null and observation_id is null)
  )
);

comment on table public.csv_import_rows is
  'Row-level CSV validation and duplicate audit evidence. Rows here are not reviewable or publishable.';

create index csv_import_batches_imported_by_idx
  on public.csv_import_batches(imported_by, created_at desc);
create index csv_import_rows_batch_outcome_idx
  on public.csv_import_rows(import_batch_id, outcome, csv_row_number);
create index csv_import_rows_observation_idx
  on public.csv_import_rows(observation_id)
  where observation_id is not null;

alter table public.csv_import_batches enable row level security;
alter table public.csv_import_rows enable row level security;

revoke all on table public.csv_import_batches from public, anon, authenticated;
revoke all on table public.csv_import_rows from public, anon, authenticated;
grant select, insert, update on table public.csv_import_batches to authenticated;
grant select, insert, update on table public.csv_import_rows to authenticated;
grant all on table public.csv_import_batches to service_role;
grant all on table public.csv_import_rows to service_role;
grant insert on table public.source_observations to authenticated;

create policy "Admins can read CSV import batches"
on public.csv_import_batches for select to authenticated
using (public.has_app_role(array['admin']::public.app_role[]));

create policy "Admins can create CSV import batches"
on public.csv_import_batches for insert to authenticated
with check (
  imported_by = (select auth.uid())
  and public.has_app_role(array['admin']::public.app_role[])
);

create policy "Admins can update CSV import batches"
on public.csv_import_batches for update to authenticated
using (
  imported_by = (select auth.uid())
  and public.has_app_role(array['admin']::public.app_role[])
)
with check (
  imported_by = (select auth.uid())
  and public.has_app_role(array['admin']::public.app_role[])
);

create policy "Admins can read CSV import row audits"
on public.csv_import_rows for select to authenticated
using (public.has_app_role(array['admin']::public.app_role[]));

create policy "Admins can create CSV import row audits"
on public.csv_import_rows for insert to authenticated
with check (
  public.has_app_role(array['admin']::public.app_role[])
  and exists (
    select 1 from public.csv_import_batches
    where csv_import_batches.id = csv_import_rows.import_batch_id
      and csv_import_batches.imported_by = (select auth.uid())
      and csv_import_batches.status = 'processing'
  )
);

create policy "Admins can link CSV audit rows"
on public.csv_import_rows for update to authenticated
using (
  public.has_app_role(array['admin']::public.app_role[])
  and exists (
    select 1 from public.csv_import_batches
    where csv_import_batches.id = csv_import_rows.import_batch_id
      and csv_import_batches.imported_by = (select auth.uid())
      and csv_import_batches.status = 'processing'
  )
)
with check (
  public.has_app_role(array['admin']::public.app_role[])
);

create policy "Admins can insert pending CSV observations"
on public.source_observations for insert to authenticated
with check (
  public.has_app_role(array['admin']::public.app_role[])
  and submitted_by = (select auth.uid())
  and import_batch_id is not null
  and location_record_id is null
  and human_review_status = 'pending'
  and reviewed_by is null
  and reviewed_at is null
  and review_note is null
  and exists (
    select 1 from public.csv_import_batches
    where csv_import_batches.id = source_observations.import_batch_id
      and csv_import_batches.imported_by = (select auth.uid())
      and csv_import_batches.status = 'processing'
  )
);

-- Permit the review workflow to attach an imported observation to its newly
-- created location while keeping all submitted evidence immutable.
create or replace function public.prevent_observation_evidence_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if row(
    new.source_url, new.source_collection_date, new.business_name_as_listed,
    new.address, new.city, new.county, new.zip_code, new.latitude,
    new.longitude, new.review_count, new.listing_status, new.analyst_notes,
    new.submitted_by, new.submitted_at, new.source_name, new.incident_type,
    new.summary, new.external_id, new.import_batch_id,
    new.original_csv_row_number, new.original_payload,
    new.normalization_log, new.import_dedup_key, new.imported_at
  ) is distinct from row(
    old.source_url, old.source_collection_date, old.business_name_as_listed,
    old.address, old.city, old.county, old.zip_code, old.latitude,
    old.longitude, old.review_count, old.listing_status, old.analyst_notes,
    old.submitted_by, old.submitted_at, old.source_name, old.incident_type,
    old.summary, old.external_id, old.import_batch_id,
    old.original_csv_row_number, old.original_payload,
    old.normalization_log, old.import_dedup_key, old.imported_at
  ) then
    raise exception 'Source observation evidence is append-only';
  end if;

  if new.location_record_id is distinct from old.location_record_id
     and not (
       old.location_record_id is null
       and new.location_record_id is not null
       and old.human_review_status = 'pending'
       and new.human_review_status = 'approved'
     ) then
    raise exception 'Observation location linkage is immutable outside approval';
  end if;

  return new;
end;
$$;

create or replace function public.review_location_observation_internal(
  p_observation_id uuid,
  p_action text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_found_id uuid;
  v_location_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required';
  end if;
  if p_action not in ('approved', 'rejected', 'correction_needed') then
    raise exception 'Invalid review action';
  end if;

  select id, location_record_id into v_found_id, v_location_id
  from public.source_observations
  where id = p_observation_id and human_review_status = 'pending'
  for update;
  if v_found_id is null then
    raise exception 'Observation is not pending review';
  end if;

  if p_action = 'approved' and v_location_id is null then
    insert into public.location_records (
      human_review_status, verification_status, verified_at
    ) values ('approved', 'verified', now())
    returning id into v_location_id;
  end if;

  update public.source_observations
  set location_record_id = case
        when p_action = 'approved' then v_location_id
        else location_record_id
      end,
      human_review_status = p_action,
      reviewed_by = v_user_id,
      reviewed_at = now(),
      review_note = nullif(trim(p_note), '')
  where id = p_observation_id;

  insert into public.review_actions(observation_id, action, note, acted_by)
  values (p_observation_id, p_action, nullif(trim(p_note), ''), v_user_id);

  if v_location_id is not null then
    update public.location_records
    set human_review_status = p_action,
        verification_status = case when p_action = 'approved' then 'verified' else 'unverified' end,
        verified_at = case when p_action = 'approved' then now() else null end
    where id = v_location_id;
  end if;
end;
$$;

comment on function public.review_location_observation_internal(uuid, text, text) is
  'Internal review helper. Approval creates and links a location for imported observations; not a direct API endpoint.';

revoke execute on function public.review_location_observation_internal(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.review_location_observation_internal(uuid, text, text)
  to service_role;
