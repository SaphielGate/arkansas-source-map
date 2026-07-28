-- Record the service-role revoke already verified in the development project.
-- Event-trigger functions run from their trigger context and must not be RPCs.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from service_role';
  else
    raise notice 'public.rls_auto_enable() is absent; no event-trigger function ACL was changed';
  end if;
end
$$;
