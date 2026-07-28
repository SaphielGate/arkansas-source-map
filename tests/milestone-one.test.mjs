import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const readProjectFile = (...parts) => readFileSync(resolve(process.cwd(), ...parts), "utf8");

test("the environment example contains only the required public Supabase settings", () => {
  const example = readProjectFile(".env.example");
  assert.match(example, /^NEXT_PUBLIC_SUPABASE_URL=/m);
  assert.match(example, /^NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=/m);
  assert.doesNotMatch(example, /^NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=/m);
});

test("local environment files and Supabase CLI metadata stay out of Git", () => {
  const gitignore = readProjectFile(".gitignore");
  assert.match(gitignore, /^\.env\.local$/m);
  assert.match(gitignore, /^supabase\/\.temp\/$/m);
  assert.doesNotMatch(gitignore, /^(<<<<<<<|=======|>>>>>>>)/m);
});

test("the browser environment loader uses statically analyzable public variables", () => {
  const loader = readProjectFile("lib", "supabase", "env.ts");
  assert.match(loader, /process\.env\.NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(loader, /process\.env\.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(loader, /process\.env\[[^\]]+\]/);
});

test("RLS is enabled for every core table", () => {
  const sql = readProjectFile("supabase", "migrations", "202607210002_rls_policies.sql");
  for (const table of ["sources", "evidence_items", "source_evidence"]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security;`));
  }
});

test("the evidence bucket is private and policies target the same bucket", () => {
  const sql = readProjectFile("supabase", "migrations", "202607210003_evidence_storage.sql");
  assert.match(sql, /values \('evidence', 'evidence', false, 52428800\)/);
  assert.match(sql, /bucket_id = 'evidence'/);
  assert.doesNotMatch(sql, /values \('evidence', 'evidence', true,/);
});

test("the source/evidence link references both core tables", () => {
  const sql = readProjectFile("supabase", "migrations", "202607210001_core_tables.sql");
  assert.match(sql, /source_id uuid not null references public\.sources\(id\)/);
  assert.match(sql, /evidence_id uuid not null references public\.evidence_items\(id\)/);
});
