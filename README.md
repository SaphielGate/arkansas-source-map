# Arkansas Source Map

Milestone 1 establishes a Next.js and Supabase foundation for organizing public-interest source records and supporting evidence in Arkansas. It does **not** include scraping, scheduled scanning, or automated source collection.

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

The SQL migrations create the `sources`, `evidence_items`, and `source_evidence` tables; enable Row Level Security; add initial authenticated-user policy skeletons; and create a private `evidence` storage bucket. Evidence paths use the convention `<auth-user-id>/<generated-filename>`.

The committed TypeScript database types mirror Milestone 1. Regenerate them after schema changes with the Supabase CLI and review the resulting diff before committing.
