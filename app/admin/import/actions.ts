"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/auth/authorization";
import {
  CsvImportError,
  IMPORT_CHUNK_SIZE,
  parseCsv,
} from "@/lib/csv-import/parser";
import type {
  CsvImportSummary,
  CsvPreview,
  CsvPreviewRow,
} from "@/lib/csv-import/types";
import type { Json } from "@/lib/supabase/database.types";

async function requireAdmin() {
  const context = await getUserContext();
  if (!context.user) throw new CsvImportError("Authentication is required");
  if (context.role !== "admin") throw new CsvImportError("Administrator access is required");
  return context.user;
}

function chunks<T>(items: T[], size: number) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size));
}

async function classifyDatabaseDuplicates(preview: CsvPreview) {
  const supabase = createClient();
  const candidates = preview.rows.filter(
    (row) => row.outcome === "valid" && row.dedupKey,
  );
  const existing = new Set<string>();
  for (const keyChunk of chunks(candidates.map((row) => row.dedupKey!), IMPORT_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("source_observations")
      .select("import_dedup_key")
      .in("import_dedup_key", keyChunk);
    if (error) throw new CsvImportError(`Duplicate lookup failed: ${error.message}`);
    for (const row of data ?? []) {
      if (row.import_dedup_key) existing.add(row.import_dedup_key);
    }
  }
  for (const row of candidates) {
    if (row.dedupKey && existing.has(row.dedupKey)) {
      row.outcome = "duplicate";
      row.duplicateReason = "existing_database";
    }
  }
  preview.validRows = preview.rows.filter((row) => row.outcome === "valid").length;
  preview.duplicateRows = preview.rows.filter((row) => row.outcome === "duplicate").length;
}

export async function previewCsvImport(filename: string, csvText: string): Promise<
  { ok: true; data: CsvPreview } | { ok: false; error: string }
> {
  try {
    await requireAdmin();
    const preview = parseCsv(filename, csvText);
    const { data, error } = await createClient()
      .from("csv_import_batches")
      .select("id")
      .eq("file_sha256", preview.fileSha256)
      .maybeSingle();
    if (error) throw new CsvImportError(`Repeat-file check failed: ${error.message}`);
    preview.repeatedFile = Boolean(data);
    preview.repeatedBatchId = data?.id ?? null;
    await classifyDatabaseDuplicates(preview);
    return { ok: true, data: preview };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "CSV preview failed" };
  }
}

function auditRow(batchId: string, row: CsvPreviewRow, observationId?: string) {
  return {
    import_batch_id: batchId,
    csv_row_number: row.csvRowNumber,
    outcome: row.outcome,
    duplicate_reason: row.duplicateReason,
    validation_errors: row.errors as Json,
    original_payload: row.original as Json,
    normalized_payload: row.normalized as Json,
    normalization_log: row.normalizationLog as Json,
    dedup_key: row.dedupKey,
    observation_id: observationId ?? null,
  };
}

export async function confirmCsvImport(
  filename: string,
  csvText: string,
): Promise<
  { ok: true; data: CsvImportSummary } | { ok: false; error: string }
> {
  try {
    return { ok: true, data: await performCsvImport(filename, csvText) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "CSV import failed" };
  }
}

async function performCsvImport(
  filename: string,
  csvText: string,
): Promise<CsvImportSummary> {
  const user = await requireAdmin();
  const preview = parseCsv(filename, csvText);
  await classifyDatabaseDuplicates(preview);
  const supabase = createClient();

  const { data: repeated } = await supabase
    .from("csv_import_batches")
    .select("id")
    .eq("file_sha256", preview.fileSha256)
    .maybeSingle();
  if (repeated) {
    throw new CsvImportError(`This exact file was already imported as batch ${repeated.id}`);
  }

  const batchInsert = {
    original_filename: filename.slice(0, 255),
    file_sha256: preview.fileSha256,
    imported_by: user.id,
    total_rows: preview.totalRows,
    valid_rows: preview.validRows,
    inserted_rows: 0,
    duplicate_rows: preview.duplicateRows,
    rejected_rows: preview.invalidRows,
    metadata: {
      parser: "papaparse@5.5.3",
      row_limit: 1000,
      chunk_size: IMPORT_CHUNK_SIZE,
    } as Json,
  };
  const { data: batch, error: batchError } = await supabase
    .from("csv_import_batches")
    .insert(batchInsert)
    .select("id")
    .single();
  if (batchError || !batch) {
    throw new CsvImportError(
      batchError?.code === "23505"
        ? "This exact file has already been imported"
        : `Unable to create import batch: ${batchError?.message ?? "unknown error"}`,
    );
  }

  try {
    const accepted = preview.rows.filter(
      (row): row is CsvPreviewRow & { normalized: NonNullable<CsvPreviewRow["normalized"]> } =>
        row.outcome === "valid" && Boolean(row.normalized),
    );
    const insertedByKey = new Map<string, string>();

    for (const rowChunk of chunks(accepted, IMPORT_CHUNK_SIZE)) {
      const observations = rowChunk.map((row) => ({
        location_record_id: null,
        source_url: row.normalized.source_url,
        source_collection_date: row.normalized.observation_date,
        business_name_as_listed: row.normalized.source_name,
        address: row.normalized.address,
        city: row.normalized.city,
        county: row.normalized.county,
        zip_code: null,
        latitude: row.normalized.latitude,
        longitude: row.normalized.longitude,
        review_count: 0,
        listing_status: "unknown",
        analyst_notes: row.normalized.notes,
        human_review_status: "pending",
        coordinate_confidence: row.normalized.confidence,
        submitted_by: user.id,
        source_name: row.normalized.source_name,
        incident_type: row.normalized.incident_type,
        summary: row.normalized.summary,
        external_id: row.normalized.external_id,
        import_batch_id: batch.id,
        original_csv_row_number: row.csvRowNumber,
        original_payload: row.original as Json,
        normalization_log: row.normalizationLog as Json,
        import_dedup_key: row.dedupKey,
        imported_at: new Date().toISOString(),
      }));
      const { data, error } = await supabase
        .from("source_observations")
        .upsert(observations, {
          onConflict: "import_dedup_key",
          ignoreDuplicates: true,
        })
        .select("id, import_dedup_key");
      if (error) throw new CsvImportError(`Observation insert failed: ${error.message}`);
      for (const inserted of data ?? []) {
        if (inserted.import_dedup_key) insertedByKey.set(inserted.import_dedup_key, inserted.id);
      }
    }

    for (const row of accepted) {
      if (row.dedupKey && !insertedByKey.has(row.dedupKey)) {
        row.outcome = "duplicate";
        row.duplicateReason = "existing_database";
      }
    }
    const audits = preview.rows.map((row) =>
      auditRow(batch.id, row, row.dedupKey ? insertedByKey.get(row.dedupKey) : undefined));
    for (const auditChunk of chunks(audits, IMPORT_CHUNK_SIZE)) {
      const { error } = await supabase.from("csv_import_rows").insert(auditChunk);
      if (error) throw new CsvImportError(`Import audit insert failed: ${error.message}`);
    }

    const insertedRows = insertedByKey.size;
    const duplicateRows = preview.rows.filter((row) => row.outcome === "duplicate").length;
    const rejectedRows = preview.rows.filter((row) => row.outcome === "invalid").length;
    const { error: completionError } = await supabase
      .from("csv_import_batches")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        valid_rows: insertedRows,
        inserted_rows: insertedRows,
        duplicate_rows: duplicateRows,
        rejected_rows: rejectedRows,
      })
      .eq("id", batch.id);
    if (completionError) throw new CsvImportError(`Batch completion failed: ${completionError.message}`);

    return {
      batchId: batch.id,
      totalRows: preview.totalRows,
      insertedRows,
      duplicateRows,
      rejectedRows,
    };
  } catch (error) {
    await supabase
      .from("csv_import_batches")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_summary: [error instanceof Error ? error.message : "Unknown import failure"],
      })
      .eq("id", batch.id);
    throw error;
  }
}
