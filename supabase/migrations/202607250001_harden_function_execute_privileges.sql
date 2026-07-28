-- Restrict public-schema RPC execution without changing function implementations.

-- Wrapper RPCs are intentional authenticated API endpoints. Their function bodies
-- enforce the narrower application-role requirements documented in the design.
revoke execute on function public.get_map_records(boolean)
  from public, anon;
revoke execute on function public.has_app_role(public.app_role[])
  from public, anon;
revoke execute on function public.review_location_observation(uuid, text, text)
  from public, anon;
revoke execute on function public.submit_location_observation(
  text, date, text, text, text, text, text, numeric, numeric, integer, text, text
) from public, anon;

grant execute on function public.get_map_records(boolean)
  to authenticated, service_role;
grant execute on function public.has_app_role(public.app_role[])
  to authenticated, service_role;
grant execute on function public.review_location_observation(uuid, text, text)
  to authenticated, service_role;
grant execute on function public.submit_location_observation(
  text, date, text, text, text, text, text, numeric, numeric, integer, text, text
) to authenticated, service_role;

comment on function public.get_map_records(boolean) is
  'Authenticated wrapper RPC; intentionally exposed only to authenticated users and protected by explicit application-role checks.';
comment on function public.has_app_role(public.app_role[]) is
  'Authenticated wrapper RPC; intentionally exposed only to authenticated users and evaluates the caller''s explicit application role.';
comment on function public.review_location_observation(uuid, text, text) is
  'Authenticated wrapper RPC; intentionally exposed only to authenticated users and protected by explicit reviewer/admin application-role checks.';
comment on function public.submit_location_observation(
  text, date, text, text, text, text, text, numeric, numeric, integer, text, text
) is
  'Authenticated wrapper RPC; intentionally exposed only to authenticated users and protected by explicit analyst/reviewer/admin application-role checks.';

-- Internal helpers execute only behind their role-checking SECURITY DEFINER
-- wrappers. They are not direct API endpoints.
revoke execute on function public.review_location_observation_internal(uuid, text, text)
  from public, anon, authenticated;
revoke execute on function public.submit_location_observation_internal(
  text, date, text, text, text, text, text, numeric, numeric, integer, text, text
) from public, anon, authenticated;

grant execute on function public.review_location_observation_internal(uuid, text, text)
  to service_role;
grant execute on function public.submit_location_observation_internal(
  text, date, text, text, text, text, text, numeric, numeric, integer, text, text
) to service_role;

comment on function public.review_location_observation_internal(uuid, text, text) is
  'Internal helper behind the authenticated review wrapper; not a direct API endpoint.';
comment on function public.submit_location_observation_internal(
  text, date, text, text, text, text, text, numeric, numeric, integer, text, text
) is
  'Internal helper behind the authenticated submission wrapper; not a direct API endpoint.';

-- Supabase-managed environments may contain this event-trigger function even
-- though it is not present in this repository's migration history. Harden it
-- where present without making a clean migration replay fail where it is absent.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
    execute $comment$
      comment on function public.rls_auto_enable() is
      'Event-trigger function used to enable RLS; not an API endpoint and must not be API-callable.'
    $comment$;
  else
    raise notice 'public.rls_auto_enable() is absent; no event-trigger function ACL was changed';
  end if;
end
$$;

-- PostgreSQL grants EXECUTE on newly created functions to PUBLIC by default.
-- Remove that default for functions created by postgres in public. Authenticated
-- access is intentionally not revoked here: future application RPCs must receive
-- an explicit authenticated grant in the migration that creates them.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon;
