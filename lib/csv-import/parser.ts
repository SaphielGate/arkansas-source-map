import { createHash } from "node:crypto";
import Papa from "papaparse";
import {
  ALL_HEADERS,
  OPTIONAL_HEADERS,
  REQUIRED_HEADERS,
  type CsvHeader,
  type CsvPreview,
  type CsvPreviewRow,
  type NormalizedCsvRow,
  type OriginalCsvRow,
} from "./types";

export const DEFAULT_MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 1000;
export const IMPORT_CHUNK_SIZE = 100;

const ALLOWED_HEADERS = new Set<string>(ALL_HEADERS);
const CONFIDENCE = new Set(["high", "medium", "low", "unknown"]);
const LIMITS: Record<CsvHeader, number> = {
  source_name: 200,
  latitude: 32,
  longitude: 32,
  county: 200,
  incident_type: 200,
  observation_date: 32,
  summary: 5000,
  city: 200,
  source_url: 2048,
  confidence: 20,
  external_id: 200,
  address: 500,
  notes: 5000,
};

export class CsvImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvImportError";
  }
}

export function getMaxFileBytes() {
  const configured = Number(process.env.CSV_IMPORT_MAX_BYTES);
  return Number.isInteger(configured) && configured > 0
    ? configured
    : DEFAULT_MAX_FILE_BYTES;
}

export function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function collapseSpacing(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeForKey(value: string) {
  return collapseSpacing(value).toLocaleLowerCase("en-US");
}

function strictDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
    ? value
    : null;
}

function normalizedUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function looksExecutable(value: string, header: CsvHeader) {
  if (header === "latitude" || header === "longitude") return false;
  return /^[=+@]/.test(value) || /^-\s*[A-Za-z]/.test(value);
}

function validateAndNormalize(
  original: OriginalCsvRow,
  csvRowNumber: number,
): CsvPreviewRow {
  const errors: string[] = [];
  const normalizationLog: string[] = [];
  const values = {} as Record<CsvHeader, string | null>;

  for (const header of ALL_HEADERS) {
    const raw = original[header] ?? "";
    if (typeof raw !== "string") {
      errors.push(`${header} must be plain text`);
      values[header] = null;
      continue;
    }
    if (raw.length > LIMITS[header]) {
      errors.push(`${header} exceeds ${LIMITS[header]} characters`);
    }
    if (looksExecutable(raw.trimStart(), header)) {
      errors.push(`${header} begins with executable spreadsheet input`);
    }
    const trimmed = raw.trim();
    if (trimmed !== raw) normalizationLog.push(`${header}: trimmed surrounding whitespace`);
    values[header] = trimmed || null;
  }

  for (const header of REQUIRED_HEADERS) {
    if (!values[header]) errors.push(`${header} is required`);
  }

  for (const header of OPTIONAL_HEADERS) {
    if (!values[header]) values[header] = null;
  }

  const latitude = Number(values.latitude);
  const longitude = Number(values.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    errors.push("latitude must be numeric and between -90 and 90");
  } else if (latitude < 33 || latitude > 37) {
    errors.push("latitude must be within the existing Arkansas database bounds (33 to 37)");
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    errors.push("longitude must be numeric and between -180 and 180");
  } else if (longitude < -95 || longitude > -89) {
    errors.push("longitude must be within the existing Arkansas database bounds (-95 to -89)");
  }

  const observationDate = values.observation_date
    ? strictDate(values.observation_date)
    : null;
  if (values.observation_date && !observationDate) {
    errors.push("observation_date must be a valid date in YYYY-MM-DD format");
  }

  const sourceUrl = values.source_url ? normalizedUrl(values.source_url) : null;
  if (values.source_url && !sourceUrl) {
    errors.push("source_url must be a valid HTTP or HTTPS URL");
  } else if (sourceUrl && sourceUrl !== values.source_url) {
    normalizationLog.push("source_url: normalized URL and removed fragment");
  }

  const confidence = (values.confidence ?? "unknown").toLowerCase();
  if (!CONFIDENCE.has(confidence)) {
    errors.push("confidence must be high, medium, low, or unknown");
  }

  const county = values.county ? collapseSpacing(values.county) : "";
  const city = values.city ? collapseSpacing(values.city) : null;
  if (county && county !== values.county) normalizationLog.push("county: normalized spacing");
  if (city && city !== values.city) normalizationLog.push("city: normalized spacing");

  if (errors.length > 0) {
    return {
      csvRowNumber,
      outcome: "invalid",
      duplicateReason: null,
      errors,
      original,
      normalized: null,
      normalizationLog,
      dedupKey: null,
    };
  }

  const normalized: NormalizedCsvRow = {
    source_name: values.source_name!,
    latitude,
    longitude,
    county,
    incident_type: values.incident_type!,
    observation_date: observationDate!,
    summary: values.summary!,
    city,
    source_url: sourceUrl,
    confidence: confidence as NormalizedCsvRow["confidence"],
    external_id: values.external_id,
    address: values.address,
    notes: values.notes,
  };
  const keyMaterial = normalized.external_id
    ? ["external_id", normalizeForKey(normalized.source_name), normalizeForKey(normalized.external_id)]
    : [
        "content",
        normalizeForKey(normalized.source_url ?? ""),
        normalizeForKey(normalized.source_name),
        normalized.observation_date,
        normalized.latitude.toFixed(6),
        normalized.longitude.toFixed(6),
        normalizeForKey(normalized.summary),
      ];

  return {
    csvRowNumber,
    outcome: "valid",
    duplicateReason: null,
    errors: [],
    original,
    normalized,
    normalizationLog,
    dedupKey: sha256(JSON.stringify(keyMaterial)),
  };
}

export function parseCsv(filename: string, csvText: string): CsvPreview {
  if (
    !filename.toLowerCase().endsWith(".csv")
    || filename.includes("/")
    || filename.includes("\\")
    || filename.length > 255
  ) {
    throw new CsvImportError("Only .csv files are accepted");
  }
  if (new TextEncoder().encode(csvText).byteLength > getMaxFileBytes()) {
    throw new CsvImportError(`CSV exceeds the ${getMaxFileBytes()} byte limit`);
  }
  if (!csvText.trim()) throw new CsvImportError("CSV file is empty");

  const parsed = Papa.parse<string[]>(csvText, {
    header: false,
    skipEmptyLines: "greedy",
  });
  if (parsed.errors.length > 0) {
    const first = parsed.errors[0];
    throw new CsvImportError(`Malformed CSV near row ${(first.row ?? 0) + 1}: ${first.message}`);
  }
  if (parsed.data.length < 2) {
    throw new CsvImportError("CSV must include a header and at least one data row");
  }

  const headerRow = parsed.data[0];
  if (!Array.isArray(headerRow) || headerRow.length === 0) {
    throw new CsvImportError("CSV header is missing");
  }
  const headers = headerRow.map((header) => String(header).replace(/^\uFEFF/, "").trim().toLowerCase());
  if (headers.some((header) => !header || header.length > 64)) {
    throw new CsvImportError("CSV contains an empty or abnormally large header");
  }
  const duplicates = headers.filter((header, index) => headers.indexOf(header) !== index);
  if (duplicates.length > 0) {
    throw new CsvImportError(`Duplicate CSV header: ${Array.from(new Set(duplicates)).join(", ")}`);
  }
  const unexpected = headers.filter((header) => !ALLOWED_HEADERS.has(header));
  if (unexpected.length > 0) {
    throw new CsvImportError(`Unexpected CSV header: ${unexpected.join(", ")}`);
  }
  const missing = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  if (missing.length > 0) {
    throw new CsvImportError(`Missing required CSV header: ${missing.join(", ")}`);
  }

  const dataRows = parsed.data.slice(1);
  if (dataRows.length > MAX_IMPORT_ROWS) {
    throw new CsvImportError(`CSV exceeds the ${MAX_IMPORT_ROWS} row limit`);
  }

  const rows = dataRows.map((cells, index) => {
    if (!Array.isArray(cells) || cells.length !== headers.length) {
      return {
        csvRowNumber: index + 2,
        outcome: "invalid",
        duplicateReason: null,
        errors: [`row has ${cells.length} columns; expected ${headers.length}`],
        original: {},
        normalized: null,
        normalizationLog: [],
        dedupKey: null,
      } satisfies CsvPreviewRow;
    }
    const original = Object.fromEntries(
      headers.map((header, cellIndex) => [header, String(cells[cellIndex] ?? "")]),
    ) as OriginalCsvRow;
    return validateAndNormalize(original, index + 2);
  });

  const seen = new Set<string>();
  for (const row of rows) {
    if (row.outcome !== "valid" || !row.dedupKey) continue;
    if (seen.has(row.dedupKey)) {
      row.outcome = "duplicate";
      row.duplicateReason = "within_file";
    } else {
      seen.add(row.dedupKey);
    }
  }

  return summarizePreview(filename, csvText, rows);
}

export function summarizePreview(
  filename: string,
  csvText: string,
  rows: CsvPreviewRow[],
): CsvPreview {
  return {
    filename,
    fileSha256: sha256(csvText),
    totalRows: rows.length,
    validRows: rows.filter((row) => row.outcome === "valid").length,
    invalidRows: rows.filter((row) => row.outcome === "invalid").length,
    duplicateRows: rows.filter((row) => row.outcome === "duplicate").length,
    repeatedFile: false,
    repeatedBatchId: null,
    rows,
  };
}
