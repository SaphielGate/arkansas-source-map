import Papa from "papaparse";
import type { CsvPreview } from "./types";

export function buildRejectedRowsCsv(preview: CsvPreview) {
  const rejected = preview.rows
    .filter((row) => row.outcome !== "valid")
    .map((row) => ({
      csv_row_number: row.csvRowNumber,
      outcome: row.outcome,
      duplicate_reason: row.duplicateReason ?? "",
      errors: row.errors.join("; "),
      ...row.original,
    }));
  return Papa.unparse(rejected, { escapeFormulae: true });
}
