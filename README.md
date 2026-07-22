# Arkansas Source Map

Milestone 2 adds an authenticated, manual Arkansas location registry and editorial review queue to the Milestone 1 foundation. It does **not** include scraping, scheduled scanning, automated source collection, heat maps, or PDF export.

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

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

The SQL migrations retain the Milestone 1 `sources`, `evidence_items`, and `source_evidence` tables and private `evidence` bucket. Milestone 2 adds `location_records`, append-only `source_observations`, and append-only `review_actions`. Permanent IDs use `AR-RM-000001`; matching source URLs or normalized addresses add observations to the existing record rather than replacing history.

Manual entry and review require an authenticated Supabase user. Reviewers can approve, reject, or request correction. Approval means a human review occurred; it does not independently verify the accuracy, completeness, or currency of a source. Only an approved registry record can carry the database-level `verified` state.

The committed TypeScript database types mirror the Milestone 2 schema. Regenerate them after later schema changes with the Supabase CLI and review the resulting diff before committing.
