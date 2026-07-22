# Arkansas Source Map

Milestone 2.5 adds sign-in, session handling, protected registry and review routes, and database-enforced application roles to the manual Arkansas location registry. It does **not** include public registration, scraping, scheduling, mapping, or PDF reports.

> Inclusion in this index does not verify, endorse, or establish the truth of a claim. Source records and evidence require independent review, context, and corroboration.

## Requirements

- Node.js 18.18 or newer
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

3. Start Supabase and apply the migrations:

```bash
supabase start
supabase db reset
```

4. Copy the local API URL and anon key printed by `supabase status` into `.env.local`. Never place a service-role key in a `NEXT_PUBLIC_` variable.

5. Start Next.js:

```bash
npm run dev
```

Open <http://localhost:3000>.

## Accounts and application roles

Accounts must be created by a trusted operator through Supabase Authentication administration. This application intentionally has no public sign-up flow. A signed-in account without a row in `public.user_roles` receives the unauthorized state.

| Role | Read registry | Manual entry | Review decisions | Manage roles |
| --- | --- | --- | --- | --- |
| `viewer` | Yes | No | No | No |
| `analyst` | Yes | Yes | No | No |
| `reviewer` | Yes | Yes | Yes | No |
| `admin` | Yes | Yes | Yes | Yes |

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

The committed TypeScript database types mirror the Milestone 2.5 schema. Regenerate them after later schema changes with the Supabase CLI and review the resulting diff before committing.
