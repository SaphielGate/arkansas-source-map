# Milestone 04 - CSV Import Engine Design Specification

**Project:** Arkansas Source Map  
**Milestone:** 04  
**Version:** 2.0  
**Status:** Design Approved (Implementation Authorized)  
**Date:** 2026-07-25

---

## Purpose

Allow authenticated administrators to validate, preview, confirm, and audit
bounded CSV imports without creating a competing review queue or publishing
unreviewed records.

## Objectives

- Parse CSV with pinned `papaparse@5.5.3`.
- Validate and normalize rows before any database write.
- Preserve original row values and normalization details.
- Classify in-file, existing-database, and repeated-file duplicates.
- Require an explicit preview and administrator confirmation.
- Insert accepted rows into the existing `source_observations` review queue.
- Keep imported observations pending and off the map until human approval.
- Preserve file-, batch-, administrator-, timestamp-, and row-level provenance.

## Architecture

GitHub → Supabase → database schema → CSV import engine → existing human review
→ Arkansas Source Map → future automated evidence pipeline

CSV upload → server-side validation → duplicate detection → preview → explicit
confirmation → chunked audit and observation inserts → existing review queue →
existing approval RPC → verified map record

`source_observations` remains the only intake and review queue. No
`observations` or `import_queue` table is introduced.

## CSV contract

Required headers:

- `source_name`
- `latitude`
- `longitude`
- `county`
- `incident_type`
- `observation_date`
- `summary`

Optional headers:

- `city`
- `source_url`
- `confidence`
- `external_id`
- `address`
- `notes`

Unknown headers and `review_status` are rejected. Headers must be unique.

## Limits

- File type: `.csv`
- File size: `CSV_IMPORT_MAX_BYTES`, default 2 MiB, maximum configured server-side
- Data rows: 1–1,000 per file
- Import insert chunk: 100 rows
- Header length: 64 characters
- `source_name`, county, city, incident type, external ID: 200 characters
- URL: 2,048 characters
- Address: 500 characters
- Summary and notes: 5,000 characters each

## Validation and normalization

- Reject empty, malformed, or object-shaped parsed values.
- Trim all fields and convert blank optional values to `null`.
- Collapse internal spacing in county and city.
- Parse strict ISO dates and store `YYYY-MM-DD`.
- Parse finite numeric coordinates. PostgreSQL and the existing Arkansas schema
  additionally constrain latitude to 33–37 and longitude to -95–-89.
- Accept only HTTP(S) URLs. Normalize protocol/host casing, remove fragments,
  and preserve path/query semantics.
- Accept confidence values already supported by `coordinate_confidence`:
  `high`, `medium`, `low`, `unknown`.
- Never accept review status from CSV. Inserted observations always use the
  database-controlled `pending` default.
- Store the original row as JSON and a list of transformations.
- Do not infer missing addresses, cities, URLs, or materially ambiguous dates.

## Duplicate strategy

The engine builds a SHA-256 row key from, in priority order:

1. normalized source name plus external ID, when external ID exists;
2. normalized source URL, source name, observation date, coordinates, and
   normalized summary.

It classifies duplicate keys within the same file and keys already stored on
`source_observations`. `file_sha256` uniquely identifies a file import. A
repeated file is blocked with a clear warning; no override silently reinserts
its rows. Duplicates remain represented in `csv_import_rows` audit records but
are not inserted as new observations.

Duplicate detection is advisory and conservative. It never merges, deletes, or
publishes records.

## Schema requirements

### `csv_import_batches`

One immutable import-level audit record:

- original filename and SHA-256
- importing administrator and timestamps
- processing status and row totals
- error summary and metadata

### `csv_import_rows`

Audit-only row outcomes, not a review queue:

- batch and original CSV row number
- original payload and normalized payload
- validation outcome, duplicate outcome, errors, and deduplication key
- optional link to the resulting `source_observations` row

### `source_observations`

Add nullable import provenance and CSV-domain fields. Imported observations may
temporarily have no `location_record_id`; approval creates and links the
production record through the existing review function. Manual observations
retain their current behavior.

## Approval and publication

Import does not insert or update `location_records`. Imported observations have:

- `human_review_status = pending`
- `location_record_id = null`
- `reviewed_by`, `reviewed_at`, and `review_note = null`

On approval, the existing review workflow creates a `location_records` row,
links the observation, records the review action, and marks the location
approved/verified. Rejection or correction does not publish a location. Existing
manual observations continue through their current linked-location path.

## Security

- `/admin/import` calls `requireRole(["admin"])` during server rendering.
- Server actions repeat authentication and database-backed `user_roles` checks.
- RLS policies authorize only administrators using `has_app_role`.
- Authorization never relies on user-editable JWT metadata.
- The browser receives only the publishable key.
- No service-role or secret key is used.
- New tables have explicit RLS, grants, indexes, and foreign keys.
- The import RPC is an authenticated wrapper with explicit admin validation;
  `PUBLIC` and `anon` execution are revoked.

## Failure and cleanup behavior

Parsing and preview are read-only. Confirmation creates one batch and writes
bounded chunks. A failed confirmation marks the batch failed with its partial
totals; completed audit rows are retained. No automatic destructive rollback is
provided because audit evidence must not be silently erased.

## Acceptance criteria

- Admin-only upload, preview, confirmation, and rejected-row export work.
- All specified validation and duplicate cases are tested.
- Repeat files cannot reinsert observations.
- Imported observations remain pending and absent from map RPC results.
- Existing manual registry, review, and map tests remain green.
- New tables have RLS and explicit grants.
- Migrations, security checks, advisors, lint, types, tests, and build are
  verified before production deployment.

## Migration verification queries

After applying the migration to a local or approved development database:

```sql
select
  c.oid::regclass as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('csv_import_batches', 'csv_import_rows')
order by c.relname;

select
  grantee,
  table_name,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('csv_import_batches', 'csv_import_rows')
  and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
order by table_name, grantee, privilege_type;

select
  policyname,
  tablename,
  roles,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'csv_import_batches',
    'csv_import_rows',
    'source_observations'
  )
order by tablename, policyname;

select count(*) as imported_locations_before_review
from public.source_observations so
join public.location_records lr on lr.id = so.location_record_id
where so.import_batch_id is not null
  and so.human_review_status = 'pending';
```

The RLS query must return `true` for both audit tables. The final count must be
zero. Use Supabase's RLS Tester or role impersonation to verify unauthenticated,
non-admin, and admin behavior before production.

## Dependencies and constraints

- Milestones 01–03 and ADR-001 through ADR-004.
- Priority 1 function-permission hardening must pass first.
- Existing applied migrations must not be modified.
- Production deployment is out of scope.
