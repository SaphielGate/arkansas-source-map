create type public.app_role as enum ('viewer', 'analyst', 'reviewer', 'admin');

create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.user_roles is
  'Application authorization roles. Accounts are created separately through trusted Supabase administration; public registration is not enabled by this application.';

create trigger user_roles_set_updated_at
before update on public.user_roles
for each row execute function public.set_updated_at();

alter table public.user_roles enable row level security;

create function public.has_app_role(p_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role = any(p_roles)
  );
$$;

revoke all on function public.has_app_role(public.app_role[]) from public;
grant execute on function public.has_app_role(public.app_role[]) to authenticated;

create policy "Users can read their own application role"
on public.user_roles for select to authenticated
using (user_id = (select auth.uid()));

create policy "Admins can read application roles"
on public.user_roles for select to authenticated
using (public.has_app_role(array['admin']::public.app_role[]));

create policy "Admins can add application roles"
on public.user_roles for insert to authenticated
with check (
  public.has_app_role(array['admin']::public.app_role[])
  and granted_by = (select auth.uid())
);

create policy "Admins can update application roles"
on public.user_roles for update to authenticated
using (public.has_app_role(array['admin']::public.app_role[]))
with check (
  public.has_app_role(array['admin']::public.app_role[])
  and granted_by = (select auth.uid())
);

create policy "Admins can remove application roles"
on public.user_roles for delete to authenticated
using (public.has_app_role(array['admin']::public.app_role[]));

-- Retain authenticated reads while requiring an assigned application role.
drop policy "Authenticated users can read sources" on public.sources;
create policy "Application users can read sources"
on public.sources for select to authenticated
using (public.has_app_role(array['viewer', 'analyst', 'reviewer', 'admin']::public.app_role[]));

drop policy "Authenticated users can read location records" on public.location_records;
create policy "Application users can read location records"
on public.location_records for select to authenticated
using (public.has_app_role(array['viewer', 'analyst', 'reviewer', 'admin']::public.app_role[]));

drop policy "Authenticated users can read source observations" on public.source_observations;
create policy "Application users can read source observations"
on public.source_observations for select to authenticated
using (public.has_app_role(array['viewer', 'analyst', 'reviewer', 'admin']::public.app_role[]));

drop policy "Authenticated users can read review actions" on public.review_actions;
create policy "Reviewers can read review actions"
on public.review_actions for select to authenticated
using (public.has_app_role(array['reviewer', 'admin']::public.app_role[]));

-- Keep the Milestone 2 implementations private and expose role-checking wrappers.
alter function public.submit_location_observation(
  text, date, text, text, text, text, text, numeric, numeric, integer, text, text
) rename to submit_location_observation_internal;
revoke all on function public.submit_location_observation_internal(
  text, date, text, text, text, text, text, numeric, numeric, integer, text, text
) from public, authenticated;

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
begin
  if not public.has_app_role(array['analyst', 'reviewer', 'admin']::public.app_role[]) then
    raise exception 'Analyst, reviewer, or admin access is required' using errcode = '42501';
  end if;

  return query select * from public.submit_location_observation_internal(
    p_source_url, p_source_collection_date, p_business_name_as_listed, p_address,
    p_city, p_county, p_zip_code, p_latitude, p_longitude, p_review_count,
    p_listing_status, p_analyst_notes
  );
end;
$$;

alter function public.review_location_observation(uuid, text, text)
rename to review_location_observation_internal;
revoke all on function public.review_location_observation_internal(uuid, text, text)
from public, authenticated;

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
begin
  if not public.has_app_role(array['reviewer', 'admin']::public.app_role[]) then
    raise exception 'Reviewer or admin access is required' using errcode = '42501';
  end if;

  perform public.review_location_observation_internal(p_observation_id, p_action, p_note);
end;
$$;

revoke all on function public.submit_location_observation(
  text, date, text, text, text, text, text, numeric, numeric, integer, text, text
) from public;
revoke all on function public.review_location_observation(uuid, text, text) from public;
grant execute on function public.submit_location_observation(
  text, date, text, text, text, text, text, numeric, numeric, integer, text, text
) to authenticated;
grant execute on function public.review_location_observation(uuid, text, text) to authenticated;
