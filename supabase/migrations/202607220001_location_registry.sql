create sequence public.location_record_number_seq;

create table public.location_records (
  id uuid primary key default extensions.gen_random_uuid(),
  record_id text not null unique default
    ('AR-RM-' || lpad(nextval('public.location_record_number_seq')::text, 6, '0')),
  human_review_status text not null default 'pending'
    check (human_review_status in ('pending', 'approved', 'rejected', 'correction_needed')),
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'verified')),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (verification_status = 'verified' and human_review_status = 'approved' and verified_at is not null)
    or (verification_status = 'unverified' and verified_at is null)
  )
);

comment on table public.location_records is
  'Arkansas location registry. Inclusion or approval does not verify, endorse, or establish the truth of a claim; independent review, context, and corroboration remain necessary.';

create table public.source_observations (
  id uuid primary key default extensions.gen_random_uuid(),
  location_record_id uuid not null references public.location_records(id) on delete restrict,
  source_url text not null check (source_url ~ '^https?://'),
  source_collection_date date not null,
  business_name_as_listed text not null check (length(trim(business_name_as_listed)) > 0),
  address text not null check (length(trim(address)) > 0),
  city text not null check (length(trim(city)) > 0),
  county text not null check (length(trim(county)) > 0),
  zip_code text not null check (zip_code ~ '^\d{5}(-\d{4})?$'),
  latitude numeric(9, 6) not null check (latitude between 33 and 37),
  longitude numeric(10, 6) not null check (longitude between -95 and -89),
  review_count integer not null check (review_count >= 0),
  listing_status text not null
    check (listing_status in ('active', 'temporarily_closed', 'permanently_closed', 'not_listed', 'unknown')),
  analyst_notes text,
  human_review_status text not null default 'pending'
    check (human_review_status in ('pending', 'approved', 'rejected', 'correction_needed')),
  normalized_address text generated always as (
    trim(regexp_replace(lower(address || ' ' || city || ' ar ' || zip_code), '[^a-z0-9]+', ' ', 'g'))
  ) stored,
  submitted_by uuid not null references auth.users(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  review_note text,
  check (
    (human_review_status = 'pending' and reviewed_by is null and reviewed_at is null)
    or (human_review_status <> 'pending' and reviewed_by is not null and reviewed_at is not null)
  )
);

comment on table public.source_observations is
  'Append-only source observations. A captured listing is not proof that its contents are accurate, complete, or current.';

create table public.review_actions (
  id uuid primary key default extensions.gen_random_uuid(),
  observation_id uuid not null references public.source_observations(id) on delete restrict,
  action text not null check (action in ('approved', 'rejected', 'correction_needed')),
  note text,
  acted_by uuid not null references auth.users(id) on delete restrict,
  acted_at timestamptz not null default now()
);

comment on table public.review_actions is
  'Append-only editorial decision log. Approval confirms human review only and is not independent verification of a listing or claim.';

create index source_observations_location_record_idx
  on public.source_observations(location_record_id, submitted_at desc);
create index source_observations_source_url_idx on public.source_observations(source_url);
create index source_observations_normalized_address_idx on public.source_observations(normalized_address);
create index source_observations_review_queue_idx
  on public.source_observations(human_review_status, submitted_at);
create index review_actions_observation_idx on public.review_actions(observation_id, acted_at);

create trigger location_records_set_updated_at
before update on public.location_records
for each row execute function public.set_updated_at();

create function public.prevent_observation_evidence_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if row(
    new.location_record_id, new.source_url, new.source_collection_date,
    new.business_name_as_listed, new.address, new.city, new.county,
    new.zip_code, new.latitude, new.longitude, new.review_count,
    new.listing_status, new.analyst_notes, new.submitted_by, new.submitted_at
  ) is distinct from row(
    old.location_record_id, old.source_url, old.source_collection_date,
    old.business_name_as_listed, old.address, old.city, old.county,
    old.zip_code, old.latitude, old.longitude, old.review_count,
    old.listing_status, old.analyst_notes, old.submitted_by, old.submitted_at
  ) then
    raise exception 'Source observation evidence is append-only';
  end if;
  return new;
end;
$$;

create trigger source_observations_are_append_only
before update on public.source_observations
for each row execute function public.prevent_observation_evidence_changes();

create function public.submit_location_observation(
  p_source_url text,
  p_source_collection_date date,
  p_business_name_as_listed text,
  p_address text,
  p_city text,
  p_county text,
  p_zip_code text,
  p_latitude numeric,
  p_longitude numeric,
  p_review_count integer,
  p_listing_status text,
  p_analyst_notes text default null
)
returns table(record_id text, observation_id uuid, duplicate_match text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_normalized_address text;
  v_location_id uuid;
  v_record_id text;
  v_observation_id uuid;
  v_duplicate_match text := 'none';
begin
  if v_user_id is null then
    raise exception 'Authentication is required';
  end if;

  v_normalized_address := trim(regexp_replace(
    lower(trim(p_address) || ' ' || trim(p_city) || ' ar ' || trim(p_zip_code)),
    '[^a-z0-9]+', ' ', 'g'
  ));

  select so.location_record_id,
         case when so.source_url = trim(p_source_url) then 'source_url' else 'normalized_address' end
  into v_location_id, v_duplicate_match
  from public.source_observations so
  where so.source_url = trim(p_source_url)
     or so.normalized_address = v_normalized_address
  order by (so.source_url = trim(p_source_url)) desc, so.submitted_at desc
  limit 1;

  if v_location_id is null then
    insert into public.location_records default values
    returning id, location_records.record_id into v_location_id, v_record_id;
  else
    select lr.record_id into v_record_id
    from public.location_records lr where lr.id = v_location_id;

    update public.location_records
    set human_review_status = 'pending', verification_status = 'unverified', verified_at = null
    where id = v_location_id;
  end if;

  insert into public.source_observations (
    location_record_id, source_url, source_collection_date, business_name_as_listed,
    address, city, county, zip_code, latitude, longitude, review_count,
    listing_status, analyst_notes, submitted_by
  ) values (
    v_location_id, trim(p_source_url), p_source_collection_date, trim(p_business_name_as_listed),
    trim(p_address), trim(p_city), trim(p_county), trim(p_zip_code), p_latitude, p_longitude,
    p_review_count, p_listing_status, nullif(trim(p_analyst_notes), ''), v_user_id
  ) returning id into v_observation_id;

  return query select v_record_id, v_observation_id, v_duplicate_match;
end;
$$;

create function public.review_location_observation(
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
  v_location_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required';
  end if;
  if p_action not in ('approved', 'rejected', 'correction_needed') then
    raise exception 'Invalid review action';
  end if;

  select location_record_id into v_location_id
  from public.source_observations
  where id = p_observation_id and human_review_status = 'pending'
  for update;
  if v_location_id is null then
    raise exception 'Observation is not pending review';
  end if;

  update public.source_observations
  set human_review_status = p_action,
      reviewed_by = v_user_id,
      reviewed_at = now(),
      review_note = nullif(trim(p_note), '')
  where id = p_observation_id;

  insert into public.review_actions(observation_id, action, note, acted_by)
  values (p_observation_id, p_action, nullif(trim(p_note), ''), v_user_id);

  update public.location_records
  set human_review_status = p_action,
      verification_status = case when p_action = 'approved' then 'verified' else 'unverified' end,
      verified_at = case when p_action = 'approved' then now() else null end
  where id = v_location_id;
end;
$$;

alter table public.location_records enable row level security;
alter table public.source_observations enable row level security;
alter table public.review_actions enable row level security;

create policy "Authenticated users can read location records"
on public.location_records for select to authenticated using (true);
create policy "Authenticated users can read source observations"
on public.source_observations for select to authenticated using (true);

create policy "Authenticated users can read review actions"
on public.review_actions for select to authenticated using (true);

revoke all on function public.submit_location_observation(
  text, date, text, text, text, text, text, numeric, numeric, integer, text, text
) from public;
revoke all on function public.review_location_observation(uuid, text, text) from public;
grant execute on function public.submit_location_observation(
  text, date, text, text, text, text, text, numeric, numeric, integer, text, text
) to authenticated;
grant execute on function public.review_location_observation(uuid, text, text) to authenticated;
