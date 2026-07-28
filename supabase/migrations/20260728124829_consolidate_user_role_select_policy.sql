-- Consolidate equivalent SELECT access into one policy so the Supabase
-- advisors do not flag public.user_roles for multiple permissive policies.

drop policy if exists "Users can read their own application role" on public.user_roles;
drop policy if exists "Admins can read application roles" on public.user_roles;

create policy "Users can read accessible application roles"
on public.user_roles for select to authenticated
using (
  user_id = (select auth.uid())
  or public.has_app_role(array['admin']::public.app_role[])
);
