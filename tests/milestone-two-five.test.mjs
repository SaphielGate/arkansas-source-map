import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const read = (...parts) => readFileSync(resolve(process.cwd(), ...parts), "utf8");
const roles = read("supabase", "migrations", "202607220002_authentication_roles.sql");

test("application roles and least-privilege RPC checks are database enforced", () => {
  assert.match(roles, /create type public\.app_role as enum \('viewer', 'analyst', 'reviewer', 'admin'\)/);
  assert.match(roles, /array\['analyst', 'reviewer', 'admin'\]::public\.app_role\[\]/);
  assert.match(roles, /array\['reviewer', 'admin'\]::public\.app_role\[\]/);
  assert.match(roles, /revoke all on function public\.submit_location_observation_internal[\s\S]*from public, authenticated/);
  assert.match(roles, /revoke all on function public\.review_location_observation_internal[\s\S]*from public, authenticated/);
});

test("role records use RLS and cannot be self-assigned by non-admins", () => {
  assert.match(roles, /alter table public\.user_roles enable row level security/);
  assert.match(roles, /Admins can add application roles/);
  assert.match(roles, /granted_by = \(select auth\.uid\(\)\)/);
  assert.doesNotMatch(roles, /Users can add their own application role/);
});

test("registry and review pages enforce their respective roles", () => {
  const registry = read("app", "registry", "page.tsx");
  const review = read("app", "review", "page.tsx");
  assert.match(registry, /requireRole\(\["analyst", "reviewer", "admin"\]\)/);
  assert.match(review, /requireRole\(\["reviewer", "admin"\]\)/);
});

test("authentication supports password sign-in and sign-out without registration", () => {
  const files = [
    read("app", "sign-in", "actions.ts"),
    read("app", "sign-in", "page.tsx"),
    read("app", "auth-actions.ts"),
  ].join("\n");
  assert.match(files, /signInWithPassword/);
  assert.match(files, /auth\.signOut/);
  assert.doesNotMatch(files, /signUp\s*\(/);
});

test("middleware protects registry and review routes", () => {
  const middleware = read("middleware.ts");
  assert.match(middleware, /"\/registry\/:path\*", "\/review\/:path\*"/);
  assert.match(middleware, /url\.pathname = "\/sign-in"/);
});

test("the first-admin process is documented without credentials", () => {
  const readme = read("README.md");
  assert.match(readme, /Bootstrap the first admin/);
  assert.match(readme, /<FIRST_ADMIN_USER_UUID>/);
  assert.doesNotMatch(readme, /service[_-]role\s*(key)?\s*[:=]\s*[A-Za-z0-9]/i);
});
