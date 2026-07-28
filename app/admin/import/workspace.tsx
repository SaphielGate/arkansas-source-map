"use client";

import { ChangeEvent, useState } from "react";
import Link from "next/link";
import { confirmCsvImport, previewCsvImport } from "./actions";
import { buildRejectedRowsCsv } from "@/lib/csv-import/export";
import type { CsvImportSummary, CsvPreview } from "@/lib/csv-import/types";

const CLIENT_MAX_BYTES = 2 * 1024 * 1024;

export default function CsvImportWorkspace() {
  const [filename, setFilename] = useState("");
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [summary, setSummary] = useState<CsvImportSummary | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setPreview(null);
    setSummary(null);
    setConfirmed(false);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setMessage("Only .csv files are accepted.");
      event.target.value = "";
      return;
    }
    if (file.size > CLIENT_MAX_BYTES) {
      setMessage(`File exceeds the ${CLIENT_MAX_BYTES} byte client limit.`);
      event.target.value = "";
      return;
    }
    setFilename(file.name);
    setCsvText(await file.text());
    setMessage(`Selected ${file.name}. Preview it before importing.`);
  }

  async function createPreview() {
    if (!filename || !csvText) return setMessage("Choose a non-empty CSV file first.");
    setProcessing(true);
    setSummary(null);
    try {
      const response = await previewCsvImport(filename, csvText);
      if (!response.ok) {
        setPreview(null);
        return setMessage(response.error);
      }
      const result = response.data;
      setPreview(result);
      setConfirmed(false);
      setMessage(result.repeatedFile
        ? `This file was already imported as batch ${result.repeatedBatchId}. It cannot be reinserted.`
        : "Preview complete. Review every outcome before confirming.");
    } catch (error) {
      setPreview(null);
      setMessage(error instanceof Error ? error.message : "CSV preview failed.");
    } finally {
      setProcessing(false);
    }
  }

  async function importRows() {
    if (!preview || !confirmed || preview.repeatedFile) return;
    setProcessing(true);
    try {
      const response = await confirmCsvImport(filename, csvText);
      if (!response.ok) return setMessage(response.error);
      const result = response.data;
      setSummary(result);
      setMessage(`Import ${result.batchId} completed. ${result.insertedRows} observations are pending review.`);
      setPreview(null);
      setConfirmed(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "CSV import failed.");
    } finally {
      setProcessing(false);
    }
  }

  function downloadRejectedRows() {
    if (!preview) return;
    const output = buildRejectedRowsCsv(preview);
    const url = URL.createObjectURL(new Blob([output], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${filename.replace(/\.csv$/i, "")}-rejected.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="workspace import-workspace">
      <section aria-labelledby="upload-heading">
        <h2 id="upload-heading">1. Upload and validate</h2>
        <p className="help">Maximum 2 MiB and 1,000 data rows. The server repeats all validation.</p>
        <label>CSV file
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={selectFile}
            disabled={processing}
          />
        </label>
        {filename && <p><strong>Filename:</strong> {filename}</p>}
        <button type="button" onClick={createPreview} disabled={processing || !csvText}>
          {processing ? "Processing…" : "Validate and preview"}
        </button>
      </section>

      {preview && <section aria-labelledby="preview-heading">
        <h2 id="preview-heading">2. Import preview</h2>
        <div className="import-totals">
          <span>Total <strong>{preview.totalRows}</strong></span>
          <span>Valid <strong>{preview.validRows}</strong></span>
          <span>Invalid <strong>{preview.invalidRows}</strong></span>
          <span>Duplicates <strong>{preview.duplicateRows}</strong></span>
        </div>
        {preview.repeatedFile && <p className="error" role="alert">
          Repeated file: batch {preview.repeatedBatchId}. Reimport is blocked.
        </p>}
        <div className="import-table-wrap">
          <table>
            <thead><tr><th>CSV row</th><th>Outcome</th><th>Source</th><th>Date</th><th>Errors or duplicate reason</th></tr></thead>
            <tbody>{preview.rows.map((row) => <tr key={row.csvRowNumber}>
              <td>{row.csvRowNumber}</td>
              <td>{row.outcome}</td>
              <td>{row.normalized?.source_name ?? row.original.source_name}</td>
              <td>{row.normalized?.observation_date ?? row.original.observation_date}</td>
              <td>{row.errors.join("; ") || row.duplicateReason?.replace("_", " ") || "Ready for pending review"}</td>
            </tr>)}</tbody>
          </table>
        </div>
        {(preview.invalidRows > 0 || preview.duplicateRows > 0) &&
          <button type="button" className="secondary" onClick={downloadRejectedRows}>
            Download rejected-row CSV
          </button>}
        {!preview.repeatedFile && <>
          <label className="confirmation">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              disabled={processing}
            />
            I reviewed this preview and confirm insertion of valid rows into the pending review queue.
          </label>
          <button type="button" onClick={importRows} disabled={!confirmed || processing}>
            {processing ? "Importing…" : `Confirm import of ${preview.validRows} rows`}
          </button>
        </>}
      </section>}

      {summary && <section aria-labelledby="summary-heading">
        <h2 id="summary-heading">Final import summary</h2>
        <p><strong>Batch:</strong> {summary.batchId}</p>
        <div className="import-totals">
          <span>Total <strong>{summary.totalRows}</strong></span>
          <span>Inserted pending <strong>{summary.insertedRows}</strong></span>
          <span>Duplicates <strong>{summary.duplicateRows}</strong></span>
          <span>Rejected <strong>{summary.rejectedRows}</strong></span>
        </div>
        <Link href="/review">Open the existing human-review queue</Link>
      </section>}
      <p className="feedback" role="status" aria-live="polite">{message}</p>
    </div>
  );
}
