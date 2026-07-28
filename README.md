# Arkansas Source Map

Milestone 3 adds an authenticated Arkansas-centered map to the manual registry and role-based review foundation. It does **not** include public registration, scraping, scheduled scanning, PDF reporting, KML or GeoJSON export, or public sharing.

> Inclusion in this index does not verify, endorse, or establish the truth of a claim. Source records and evidence require independent review, context, and corroboration.

## Requirements

- Node.js 20 or newer
- npm
- Supabase CLI (for the local database workflow)
- Docker-compatible container runtime (required by the Supabase CLI)

## Local setup

1. Install JavaScript dependencies:

```bash
npm install
```

2. Copy the environment example:

```bash
cp .env.example .env.local
```

For a hosted Supabase project, set these required values in `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Find both values in Supabase Dashboard under Project Settings → API. The
publishable key is intentionally available to the browser; authorization still
depends on Supabase Authentication, application-role checks, and RLS.

Do not commit `.env.local`. It is ignored by Git. Each developer must create
their own copy, and deployment platforms such as Vercel must receive the same
variables through their environment-variable settings.

The non-`NEXT_PUBLIC_` values in `.env.example` are reserved for future
server-only API handlers. The current Next.js application uses the typed browser
and SSR clients in `lib/supabase/` and does not require `SUPABASE_SECRET_KEY`.
Never place a secret or service-role key in a `NEXT_PUBLIC_` variable.

3. To use the local Supabase stack instead of a hosted project, start Supabase
   and apply the migrations:

```bash
npx supabase start --ignore-health-check
npx supabase migration up
```

Then copy the local API URL and publishable key printed by `npx supabase status`
into `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local publishable key>
```

The app uses the local API URL, not the direct database URL, Studio URL, storage
S3 URL, or development tools URL. If `npx supabase db reset` is needed for a
clean local database, it may report a container health-check timeout while
services are still starting. Wait briefly, run `npx supabase start
--ignore-health-check`, and verify migration state with `npx supabase migration
list --local`. Local reset replaces local database contents; do not run it
against production.

4. Start Next.js:

```bash
npm run dev
```

Open <http://localhost:3000>.

## CSV Import Engine

Authenticated administrators can open `/admin/import` to upload bounded CSV
files into the existing `source_observations` human-review queue:

`CSV → validation → normalization → duplicate classification → preview → admin confirmation → pending source_observations → human review → approved location_records → map`

CSV import never writes directly to `location_records`. Imported observations
have a system-controlled `pending` status and no location link. The existing
review RPC creates and verifies a location only when a reviewer or administrator
approves the observation.

### CSV columns

Required:

- `source_name`
- `latitude`
- `longitude`
- `county`
- `incident_type`
- `observation_date`
- `summary`

Optional:

- `city`
- `source_url`
- `confidence`
- `external_id`
- `address`
- `notes`

`review_status` and unknown headers are rejected. Download the version-controlled
[CSV template](docs/fixtures/Milestone_04_CSV_Import_Template.csv) for a complete
example:

```csv
source_name,latitude,longitude,county,incident_type,observation_date,summary,city,source_url,confidence,external_id,address,notes
Example Public Source,34.7465,-92.2896,Pulaski,example_observation,2026-07-01,Replace this example with a concise factual observation,Little Rock,https://example.org/source,medium,EXAMPLE-001,100 Example Street,Optional neutral notes
```

### Validation and limits

- `.csv` files only; empty and malformed files are rejected.
- Default maximum file size: 2 MiB. Set `CSV_IMPORT_MAX_BYTES` server-side to
  choose a different positive byte limit.
- Maximum 1,000 data rows and insert chunks of 100.
- Required values cannot be blank; headers must be unique.
- Dates must be valid `YYYY-MM-DD` values.
- URLs must use HTTP or HTTPS.
- Confidence must be `high`, `medium`, `low`, or `unknown`.
- Coordinates must be globally valid and fit the existing Arkansas database
  bounds: latitude 33–37 and longitude -95–-89.
- Text fields use the documented 200/500/2,048/5,000-character limits.
- Spreadsheet-executable text is rejected.
- Whitespace, city/county spacing, dates, and URLs receive only deterministic,
  recorded normalization. Ambiguous values are never guessed.

### Duplicates, auditing, and safety

The engine hashes the normalized external ID when present; otherwise it hashes
the normalized source URL/name, observation date, coordinates, and summary.
Duplicates within a file and duplicates already stored in the database appear
in the preview and audit totals but are not silently inserted or published.

The whole-file SHA-256 prevents accidental repeat uploads. Repeated files are
blocked and identify the existing batch. Every attempted row is retained in
`csv_import_rows` with its original CSV row number, original and normalized
payloads, transformations, validation errors, duplicate outcome, and optional
observation link. `csv_import_batches` records the file, importing administrator,
timestamps, status, and totals. These tables are audit logs, not a second review
queue.

The page and server actions both require a database-backed `admin` role. RLS and
explicit grants repeat that authorization in PostgreSQL. No user-editable JWT
metadata, service-role key, or secret key authorizes browser imports.

### Testing and rollback

Run the complete verification suite:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Database verification must additionally apply new migrations to a local or
approved development environment, rerun the Supabase Security and Performance
Advisors, confirm RLS on both CSV audit tables, and exercise pending/approval
visibility with admin and non-admin accounts.

Do not edit or reverse an applied migration. If Milestone 4 must be disabled,
remove access to `/admin/import` and use a new forward migration to revoke import
grants/policies. Preserve existing batches, row audits, and observations unless
a separately reviewed retention decision authorizes deletion. A schema rollback
must account for imported observations and their audit foreign keys before
making columns or tables unavailable.

## Accounts and application roles

Accounts must be created by a trusted operator through Supabase Authentication administration. This application intentionally has no public sign-up flow. A signed-in account without a row in `public.user_roles` receives the unauthorized state.

| Role | Read registry | Manual entry | Review decisions | Manage roles |
| --- | --- | --- | --- | --- |
| `viewer` | Yes | No | No | No |
| `analyst` | Yes | Yes | No | No |
| `reviewer` | Yes | Yes | Yes | No |
| `admin` | Yes | Yes | Yes | Yes |

## Interactive map

The protected `/map` route uses client-side Leaflet with OpenStreetMap tiles. Approved and verified records are the only records visible by default. Marker clusters summarize nearby points, while the optional heat layer represents relative concentration weighted by the recorded review count. Filters cover county, city, ZIP code, current listing status, human review status, first-seen date, and last-seen date.

Reviewers and admins receive an explicit, disabled-by-default control for a separate pending review layer. Viewers and analysts cannot request pending map data: the map RPC and table RLS policies enforce that boundary independently of the interface. Coordinates marked `low` or `unknown` receive a visual warning and should be interpreted using the listed address as the primary reference.

> This map documents businesses appearing in selected public-source datasets. Inclusion, review activity, proximity, or clustering does not establish criminal conduct.

### Bootstrap the first admin

1. Disable public sign-ups in Supabase Authentication settings.
2. Create the first account through the Supabase dashboard’s Authentication user administration. Use a unique administrator email and a securely delivered temporary password; require the operator to replace it promptly.
3. Copy that user’s UUID from Authentication administration. Do not copy a password, access token, anon key, or service-role key into SQL or the repository.
4. In the authenticated Supabase SQL editor, verify the target before granting access:

   ```sql
   select id, email from auth.users where id = '<FIRST_ADMIN_USER_UUID>';
   ```

5. If and only if the returned account is correct, bootstrap the role in a transaction:

   ```sql
   begin;
   insert into public.user_roles (user_id, role, granted_by)
   values ('<FIRST_ADMIN_USER_UUID>', 'admin', null);
   commit;
   ```

The nullable `granted_by` is reserved for this first bootstrap. Subsequent role changes should be performed by an authenticated admin and record that admin’s UUID in `granted_by`. Review role assignments periodically and remove access promptly when it is no longer needed.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

The SQL migrations retain the Milestone 1 `sources`, `evidence_items`, and `source_evidence` tables and private `evidence` bucket. Milestone 2 adds `location_records`, append-only `source_observations`, and append-only `review_actions`. Permanent IDs use `AR-RM-000001`; matching source URLs or normalized addresses add observations to the existing record rather than replacing history.

Manual entry requires an authenticated `analyst`, `reviewer`, or `admin`. Review decisions require an authenticated `reviewer` or `admin`. These requirements are enforced inside security-definer database wrappers as well as in protected server-rendered routes. Approval means a human review occurred; it does not independently verify the accuracy, completeness, or currency of a source. Only an approved registry record can carry the database-level `verified` state.

The committed TypeScript database types mirror the Milestone 3 schema. Regenerate them after later schema changes with the Supabase CLI and review the resulting diff before committing.
