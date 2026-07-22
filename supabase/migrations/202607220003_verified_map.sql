alter table public.source_observations
add column coordinate_confidence text not null default 'unknown'
check (coordinate_confidence in ('high', 'medium', 'low', 'unknown'));

comment on column public.source_observations.coordinate_confidence is
  'Analyst assessment of coordinate precision. Unknown and low-confidence points must be presented with an explicit caution.';

create index location_records_map_visibility_idx
  on public.location_records(verification_status, human_review_status, id);
create index source_observations_map_latest_idx
  on public.source_observations(location_record_id, source_collection_date desc, submitted_at desc)
  include (latitude, longitude, city, county, zip_code, listing_status, human_review_status);

drop policy "Application users can read location records" on public.location_records;
create policy "Application users can read permitted location records"
on public.location_records for select to authenticated
using (
  public.has_app_role(array['reviewer', 'admin']::public.app_role[])
  or (
    public.has_app_role(array['viewer', 'analyst']::public.app_role[])
    and verification_status = 'verified'
    and human_review_status = 'approved'
  )
);

drop policy "Application users can read source observations" on public.source_observations;
create policy "Application users can read permitted source observations"
on public.source_observations for select to authenticated
using (
  public.has_app_role(array['reviewer', 'admin']::public.app_role[])
  or (
    public.has_app_role(array['viewer', 'analyst']::public.app_role[])
    and exists (
      select 1 from public.location_records
      where location_records.id = source_observations.location_record_id
        and location_records.verification_status = 'verified'
        and location_records.human_review_status = 'approved'
    )
  )
);

create function public.get_map_records(p_include_pending boolean default false)
returns table(
  location_record_id uuid,
  record_id text,
  observation_id uuid,
  business_name_as_listed text,
  address text,
  city text,
  county text,
  zip_code text,
  latitude numeric,
  longitude numeric,
  source_url text,
  collection_date date,
  first_seen date,
  last_seen date,
  review_count integer,
  record_status text,
  human_review_status text,
  analyst_notes text,
  coordinate_confidence text,
  review_layer boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_app_role(array['viewer', 'analyst', 'reviewer', 'admin']::public.app_role[]) then
    raise exception 'An assigned application role is required' using errcode = '42501';
  end if;

  if p_include_pending
     and not public.has_app_role(array['reviewer', 'admin']::public.app_role[]) then
    raise exception 'Reviewer or admin access is required for pending map records' using errcode = '42501';
  end if;

  return query
  select
    lr.id,
    lr.record_id,
    latest.id,
    latest.business_name_as_listed,
    latest.address,
    latest.city,
    latest.county,
    latest.zip_code,
    latest.latitude,
    latest.longitude,
    latest.source_url,
    latest.source_collection_date,
    history.first_seen,
    history.last_seen,
    latest.review_count,
    latest.listing_status,
    lr.human_review_status,
    latest.analyst_notes,
    latest.coordinate_confidence,
    not (lr.verification_status = 'verified' and lr.human_review_status = 'approved')
  from public.location_records lr
  cross join lateral (
    select so.*
    from public.source_observations so
    where so.location_record_id = lr.id
    order by so.source_collection_date desc, so.submitted_at desc
    limit 1
  ) latest
  cross join lateral (
    select min(so.source_collection_date) as first_seen,
           max(so.source_collection_date) as last_seen
    from public.source_observations so
    where so.location_record_id = lr.id
  ) history
  where (
    lr.verification_status = 'verified'
    and lr.human_review_status = 'approved'
  ) or (
    p_include_pending
    and lr.verification_status = 'unverified'
    and lr.human_review_status = 'pending'
  )
  order by lr.record_id;
end;
$$;

revoke all on function public.get_map_records(boolean) from public;
grant execute on function public.get_map_records(boolean) to authenticated;
