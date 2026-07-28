import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { buildRejectedRowsCsv } from "../lib/csv-import/export";
import { CsvImportError, parseCsv } from "../lib/csv-import/parser";

const read = (...parts: string[]) => readFileSync(resolve(process.cwd(), ...parts), "utf8");
const headers = "source_name,latitude,longitude,county,incident_type,observation_date,summary,city,source_url,confidence,external_id,address,notes";
const validRow = "Example Source,34.7465,-92.2896,Pulaski,listing,2026-07-01,Factual summary,Little Rock,https://EXAMPLE.org/source#fragment,medium,EXT-1,100 Main St,Neutral note";
const csv = (row = validRow, customHeaders = headers) => `${customHeaders}\n${row}\n`;

function rejects(input: string, pattern: RegExp, filename = "import.csv") {
  assert.throws(() => parseCsv(filename, input), (error: unknown) =>
    error instanceof CsvImportError && pattern.test(error.message));
}

test("successful CSV parsing normalizes values and produces preview totals", () => {
  const preview = parseCsv("import.csv", csv());
  assert.equal(preview.totalRows, 1);
  assert.equal(preview.validRows, 1);
  assert.equal(preview.invalidRows, 0);
  assert.equal(preview.duplicateRows, 0);
  assert.equal(preview.rows[0].normalized?.source_url, "https://example.org/source");
  assert.match(preview.rows[0].dedupKey ?? "", /^[a-f0-9]{64}$/);
});

test("required-header failure is rejected", () => {
  rejects(csv(validRow, headers.replace(",summary", "")), /Missing required CSV header: summary/);
});

test("missing required values are row-level validation errors", () => {
  const preview = parseCsv("import.csv", csv(validRow.replace("Example Source", "")));
  assert.equal(preview.invalidRows, 1);
  assert.match(preview.rows[0].errors.join(" "), /source_name is required/);
});

test("invalid coordinates are rejected", () => {
  const preview = parseCsv("import.csv", csv(validRow.replace("34.7465", "91")));
  assert.equal(preview.invalidRows, 1);
  assert.match(preview.rows[0].errors.join(" "), /latitude/);
});

test("coordinates outside existing Arkansas constraints are rejected", () => {
  const preview = parseCsv("import.csv", csv(validRow.replace("34.7465", "40")));
  assert.match(preview.rows[0].errors.join(" "), /Arkansas database bounds/);
});

test("invalid dates are rejected", () => {
  const preview = parseCsv("import.csv", csv(validRow.replace("2026-07-01", "2026-02-30")));
  assert.match(preview.rows[0].errors.join(" "), /valid date/);
});

test("invalid URLs are rejected", () => {
  const preview = parseCsv("import.csv", csv(validRow.replace("https://EXAMPLE.org/source#fragment", "javascript:alert(1)")));
  assert.match(preview.rows[0].errors.join(" "), /HTTP or HTTPS URL/);
});

test("empty CSV is rejected", () => rejects("", /empty/));

test("malformed CSV is rejected", () => rejects(`${headers}\n"unterminated`, /Malformed CSV/));

test("duplicate headers are rejected", () => {
  rejects(csv(validRow, `${headers},summary`), /Duplicate CSV header: summary/);
});

test("unexpected and review_status headers are rejected", () => {
  rejects(csv(validRow, `${headers},review_status`), /Unexpected CSV header: review_status/);
});

test("duplicate rows within one file are classified without insertion", () => {
  const preview = parseCsv("import.csv", `${headers}\n${validRow}\n${validRow}\n`);
  assert.equal(preview.validRows, 1);
  assert.equal(preview.duplicateRows, 1);
  assert.equal(preview.rows[1].duplicateReason, "within_file");
});

test("object-shaped parsed rows and executable spreadsheet input are rejected", () => {
  const preview = parseCsv("import.csv", csv(validRow.replace("Example Source", "=HYPERLINK(1)")));
  assert.match(preview.rows[0].errors.join(" "), /executable spreadsheet input/);
});

test("abnormally large fields are rejected", () => {
  const preview = parseCsv("import.csv", csv(validRow.replace("Factual summary", "x".repeat(5001))));
  assert.match(preview.rows[0].errors.join(" "), /exceeds 5000/);
});

test("rejected-row export includes original row numbers and formula escaping", () => {
  const preview = parseCsv("import.csv", csv(validRow.replace("Example Source", "=BAD")));
  const output = buildRejectedRowsCsv(preview);
  assert.match(output, /csv_row_number/);
  assert.match(output, /\b2\b/);
  assert.match(output, /'=BAD/);
});

test("database duplicate and repeat-file checks are enforced server-side", () => {
  const actions = read("app", "admin", "import", "actions.ts");
  assert.match(actions, /\.in\("import_dedup_key"/);
  assert.match(actions, /\.eq\("file_sha256", preview\.fileSha256\)/);
  assert.match(actions, /already imported/);
  assert.match(actions, /ignoreDuplicates: true/);
});

test("admin page and server action both enforce admin access", () => {
  const page = read("app", "admin", "import", "page.tsx");
  const actions = read("app", "admin", "import", "actions.ts");
  assert.match(page, /requireRole\(\["admin"\]\)/);
  assert.match(actions, /context\.role !== "admin"/);
  assert.match(actions, /if \(!context\.user\)/);
  assert.match(read("middleware.ts"), /"\/admin\/:path\*"/);
});

test("status is system-controlled pending and import never directly publishes", () => {
  const actions = read("app", "admin", "import", "actions.ts");
  assert.match(actions, /human_review_status: "pending"/);
  assert.match(actions, /location_record_id: null/);
  assert.doesNotMatch(actions, /\.from\("location_records"\)\.(insert|upsert)/);
});

test("approval links imported observations through the existing workflow", () => {
  const migration = read("supabase", "migrations", "202607250003_csv_import_engine.sql");
  assert.match(migration, /if p_action = 'approved' and v_location_id is null/);
  assert.match(migration, /insert into public\.location_records/);
  assert.match(migration, /new\.human_review_status = 'approved'/);
  assert.match(migration, /insert into public\.review_actions/);
});

test("new audit tables use RLS and source_observations remains the only queue", () => {
  const migration = read("supabase", "migrations", "202607250003_csv_import_engine.sql");
  assert.match(migration, /alter table public\.csv_import_batches enable row level security/);
  assert.match(migration, /alter table public\.csv_import_rows enable row level security/);
  assert.match(migration, /Admins can insert pending CSV observations/);
  assert.doesNotMatch(migration, /create table public\.(import_queue|observations)\b/);
});

test("authenticated table grants support RLS-gated CSV imports", () => {
  const migration = read("supabase", "migrations", "20260727191207_restore_authenticated_table_select_grants.sql");
  assert.match(migration, /grant select on table public\.user_roles to authenticated/);
  assert.match(migration, /grant select on table public\.location_records to authenticated/);
  assert.match(migration, /grant select on table public\.source_observations to authenticated/);
});

test("import is bounded and chunked", () => {
  const parser = read("lib", "csv-import", "parser.ts");
  const actions = read("app", "admin", "import", "actions.ts");
  assert.match(parser, /MAX_IMPORT_ROWS = 1000/);
  assert.match(actions, /IMPORT_CHUNK_SIZE/);
});
