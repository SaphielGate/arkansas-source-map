import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { emptyMapFilters, filterMapRecords, isOrdinaryVisible } from "../lib/map/filtering.mjs";

const verified = {
  record_id: "AR-RM-000001", county: "Pulaski", city: "Little Rock", zip_code: "72201",
  record_status: "active", human_review_status: "approved", first_seen: "2026-01-01",
  last_seen: "2026-06-01", review_layer: false,
};
const pending = {
  record_id: "AR-RM-000002", county: "Washington", city: "Fayetteville", zip_code: "72701",
  record_status: "unknown", human_review_status: "pending", first_seen: "2026-03-01",
  last_seen: "2026-05-01", review_layer: true,
};

test("ordinary map visibility excludes pending records by default", () => {
  assert.equal(isOrdinaryVisible(verified), true);
  assert.equal(isOrdinaryVisible(pending), false);
  assert.deepEqual(filterMapRecords([verified, pending], { ...emptyMapFilters }).map((record) => record.record_id), ["AR-RM-000001"]);
});

test("the explicit reviewer layer can include pending records", () => {
  assert.deepEqual(filterMapRecords([verified, pending], { ...emptyMapFilters }, true).map((record) => record.record_id), ["AR-RM-000001", "AR-RM-000002"]);
});

test("map filters combine county, city, ZIP, status, review status, and dates", () => {
  const filters = {
    county: "Pulaski", city: "Little Rock", zipCode: "72201", recordStatus: "active",
    humanReviewStatus: "approved", firstSeenFrom: "2025-12-31", lastSeenThrough: "2026-06-30",
  };
  assert.deepEqual(filterMapRecords([verified, pending], filters, true), [verified]);
  assert.deepEqual(filterMapRecords([verified], { ...filters, firstSeenFrom: "2026-02-01" }), []);
  assert.deepEqual(filterMapRecords([verified], { ...filters, lastSeenThrough: "2026-05-01" }), []);
});

test("the map RPC and RLS policies enforce verified visibility and reviewer-only pending access", () => {
  const sql = readFileSync(resolve(process.cwd(), "supabase", "migrations", "202607220003_verified_map.sql"), "utf8");
  assert.match(sql, /verification_status = 'verified'[\s\S]*human_review_status = 'approved'/);
  assert.match(sql, /p_include_pending[\s\S]*has_app_role\(array\['reviewer', 'admin'\]/);
  assert.match(sql, /Reviewer or admin access is required for pending map records/);
  assert.match(sql, /location_records_map_visibility_idx/);
  assert.match(sql, /source_observations_map_latest_idx/);
});

test("the exact map disclaimer and deferred-scope exclusions are present", () => {
  const page = readFileSync(resolve(process.cwd(), "app", "map", "page.tsx"), "utf8");
  assert.match(page, /This map documents businesses appearing in selected public-source datasets\. Inclusion, review activity, proximity, or clustering does not establish criminal conduct\./);
  const implementation = [page, readFileSync(resolve(process.cwd(), "app", "map", "map-view.tsx"), "utf8")].join("\n").toLowerCase();
  for (const deferred of ["scraping", "scheduled scanning", "pdf report", "kml export", "geojson export", "public sharing"]) {
    assert.doesNotMatch(implementation, new RegExp(deferred));
  }
});
