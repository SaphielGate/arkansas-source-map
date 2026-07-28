export const REQUIRED_HEADERS = [
  "source_name",
  "latitude",
  "longitude",
  "county",
  "incident_type",
  "observation_date",
  "summary",
] as const;

export const OPTIONAL_HEADERS = [
  "city",
  "source_url",
  "confidence",
  "external_id",
  "address",
  "notes",
] as const;

export const ALL_HEADERS = [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS] as const;

export type CsvHeader = (typeof ALL_HEADERS)[number];
export type OriginalCsvRow = Partial<Record<CsvHeader, string>>;

export type NormalizedCsvRow = {
  source_name: string;
  latitude: number;
  longitude: number;
  county: string;
  incident_type: string;
  observation_date: string;
  summary: string;
  city: string | null;
  source_url: string | null;
  confidence: "high" | "medium" | "low" | "unknown";
  external_id: string | null;
  address: string | null;
  notes: string | null;
};

export type CsvRowOutcome = "valid" | "invalid" | "duplicate";
export type DuplicateReason = "within_file" | "existing_database" | null;

export type CsvPreviewRow = {
  csvRowNumber: number;
  outcome: CsvRowOutcome;
  duplicateReason: DuplicateReason;
  errors: string[];
  original: OriginalCsvRow;
  normalized: NormalizedCsvRow | null;
  normalizationLog: string[];
  dedupKey: string | null;
};

export type CsvPreview = {
  filename: string;
  fileSha256: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  repeatedFile: boolean;
  repeatedBatchId: string | null;
  rows: CsvPreviewRow[];
};

export type CsvImportSummary = {
  batchId: string;
  totalRows: number;
  insertedRows: number;
  duplicateRows: number;
  rejectedRows: number;
};
