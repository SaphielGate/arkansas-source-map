-- Restore table-level SELECT privileges required by existing RLS policies.
-- RLS remains the authorization gate for application-role access.

grant select on table public.user_roles to authenticated;
grant select on table public.sources to authenticated;
grant select on table public.location_records to authenticated;
grant select on table public.source_observations to authenticated;
grant select on table public.review_actions to authenticated;
