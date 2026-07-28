# Supabase Function Execute Hardening

**Project:** Arkansas Source Map  
**Version:** 1.0  
**Status:** Draft  
**Date:** 2026-07-25

---

## Purpose

Restrict execution of the existing public-schema functions to their intended
database roles without changing function bodies, application-role checks, RLS
policies, or application behavior.

## Scope and objectives

- Remove inherited `PUBLIC` execution and direct `anon` execution from the seven
  functions in scope.
- Keep the four role-checking wrapper RPCs available to `authenticated`.
- Remove direct `authenticated` execution from both internal helpers and from
  the `rls_auto_enable()` event-trigger function.
- Preserve explicit `service_role` execution for application wrappers and
  internal helpers.
- Prevent functions subsequently created by `postgres` in `public` from
  receiving default `PUBLIC` or `anon` execution.
- Require future authenticated application RPCs to receive an intentional,
  explicit grant in their creating migration.

## Existing architecture and data flow

The access path remains:

`authenticated caller -> wrapper RPC -> has_app_role(...) -> internal helper`

`get_map_records(...)` and `has_app_role(...)` are authenticated application
RPCs without internal-helper counterparts. The review and submission wrappers
validate application roles before invoking their internal helpers as the
function owner. No table, schema, function implementation, RLS policy, or data
flow changes in this hardening.

The repository migration history defines the six wrapper/helper functions. It
does not define `public.rls_auto_enable()`. That event-trigger function may be
provided in an existing Supabase-managed environment, so the migration hardens
it conditionally and emits a notice when it is absent. A missing function must
be investigated during linked-environment review.

## Access requirements

| Function | PUBLIC | anon | authenticated | service_role |
| --- | --- | --- | --- | --- |
| `get_map_records(boolean)` | No | No | Yes | Yes |
| `has_app_role(app_role[])` | No | No | Yes | Yes |
| `review_location_observation(uuid, text, text)` | No | No | Yes | Yes |
| `review_location_observation_internal(uuid, text, text)` | No | No | No | Yes |
| `rls_auto_enable()` | No | No | No | No |
| `submit_location_observation(...)` | No | No | Yes | Yes |
| `submit_location_observation_internal(...)` | No | No | No | Yes |

The internal helpers are not direct API endpoints. Explicit `service_role`
grants preserve trusted operational access without exposing them to anonymous
or ordinary authenticated callers. The event-trigger function has no API role
grant because it must run only through its event-trigger context.

## Security and validation rules

- Wrapper RPCs remain intentionally exposed only to `authenticated`.
- `get_map_records(...)` and `has_app_role(...)` require an assigned application
  role as implemented by their existing bodies.
- Review requires `reviewer` or `admin`.
- Submission requires `analyst`, `reviewer`, or `admin`.
- Internal helpers must not be directly executable by `PUBLIC`, `anon`, or
  `authenticated`.
- `rls_auto_enable()` must not be API-callable.
- Default privileges affect only future functions created by `postgres` in the
  `public` schema. They remove `PUBLIC` and `anon`; they do not globally revoke
  `authenticated`.

## Supabase advisor findings

The remaining authenticated `SECURITY DEFINER` findings for
`get_map_records(...)`, `has_app_role(...)`,
`review_location_observation(...)`, and `submit_location_observation(...)` are
intentional. These are application-facing RPC boundaries, use fixed empty
`search_path` settings, and enforce explicit application-role checks in their
existing bodies. Their authenticated execution grants must remain explicit.

## Verification plan

Apply the migration only to a local or review database, then run:

```sql
with target_functions(signature, expected_present) as (
  values
    ('public.get_map_records(boolean)', true),
    ('public.has_app_role(public.app_role[])', true),
    ('public.review_location_observation(uuid,text,text)', true),
    ('public.review_location_observation_internal(uuid,text,text)', true),
    ('public.rls_auto_enable()', true),
    ('public.submit_location_observation(text,date,text,text,text,text,text,numeric,numeric,integer,text,text)', true),
    ('public.submit_location_observation_internal(text,date,text,text,text,text,text,numeric,numeric,integer,text,text)', true)
),
roles(role_name) as (
  values ('PUBLIC'), ('anon'), ('authenticated'), ('service_role')
)
select
  target_functions.signature as function,
  roles.role_name as role,
  to_regprocedure(target_functions.signature) is not null as function_exists,
  case
    when to_regprocedure(target_functions.signature) is null then null
    when roles.role_name = 'PUBLIC' then exists (
      select 1
      from pg_proc
      cross join lateral aclexplode(
        coalesce(pg_proc.proacl, acldefault('f', pg_proc.proowner))
      ) function_acl
      where pg_proc.oid = to_regprocedure(target_functions.signature)
        and function_acl.grantee = 0
        and function_acl.privilege_type = 'EXECUTE'
    )
    else has_function_privilege(
      roles.role_name,
      to_regprocedure(target_functions.signature),
      'EXECUTE'
    )
  end as has_execute
from target_functions
cross join roles
order by target_functions.signature, roles.role_name;
```

Verify the future-function defaults separately:

```sql
select
  defaclrole::regrole as creator_role,
  coalesce(defaclnamespace::regnamespace::text, 'all schemas') as schema_name,
  defaclacl
from pg_default_acl
where defaclrole = 'postgres'::regrole
  and defaclnamespace = 'public'::regnamespace
  and defaclobjtype = 'f';
```

Review should fail if any expected function is missing in the target
environment, if the access matrix differs from the table above, or if future
functions created by `postgres` still inherit execution through `PUBLIC` or
`anon`.

## Acceptance criteria

- The reported `PUBLIC`, `anon`, and `authenticated` matrix matches the required
  access table.
- `service_role` retains the documented trusted access.
- Function definitions and RLS policies are unchanged.
- Default privileges remove future `PUBLIC` and `anon` function execution for
  `postgres` in `public`.
- The migration is reviewed before any production application.

## Dependencies and implementation constraints

- Depends on migrations through `202607220003_verified_map.sql`.
- Consistent with Milestone 02 authentication and Milestone 03 source-registry
  boundaries.
- No new ADR is required because this implements the existing authorization
  model rather than changing system architecture or governance.
- Production application is explicitly out of scope.
