import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const read = (...parts) => readFileSync(resolve(process.cwd(), ...parts), "utf8");
const migration = read("supabase", "migrations", "202607220001_location_registry.sql");

test("permanent record IDs use the required Arkansas format", () => {
  assert.match(migration, /'AR-RM-' \|\| lpad\(nextval\('public\.location_record_number_seq'\)::text, 6, '0'\)/);
});

test("observations contain every required source field and preserve evidence on update", () => {
  for (const field of ["source_url", "source_collection_date", "business_name_as_listed", "address", "city", "county", "zip_code", "latitude", "longitude", "review_count", "listing_status", "analyst_notes", "human_review_status"]) {
    assert.match(migration, new RegExp(`\\b${field}\\b`));
  }
  assert.match(migration, /raise exception 'Source observation evidence is append-only'/);
  assert.doesNotMatch(migration, /on public\.source_observations for delete/);
});

test("duplicate matching checks source URL and normalized address", () => {
  assert.match(migration, /so\.source_url = trim\(p_source_url\)/);
  assert.match(migration, /so\.normalized_address = v_normalized_address/);
  assert.match(migration, /insert into public\.source_observations/);
});

test("review actions are constrained and verification requires approval", () => {
  assert.match(migration, /action in \('approved', 'rejected', 'correction_needed'\)/);
  assert.match(migration, /verification_status = 'verified' and human_review_status = 'approved'/);
  assert.match(migration, /case when p_action = 'approved' then 'verified' else 'unverified' end/);
  assert.match(migration, /security definer/);
  assert.doesNotMatch(migration, /on public\.location_records for update/);
  assert.doesNotMatch(migration, /on public\.source_observations for update/);
});

test("Milestone 2 does not add deferred features", () => {
  const project = [migration, read("app", "registry-workspace.tsx")].join("\n").toLowerCase();
  for (const deferred of ["scraper", "scheduled scan", "heat map", "pdf export"]) {
    assert.doesNotMatch(project, new RegExp(deferred));
  }
});
