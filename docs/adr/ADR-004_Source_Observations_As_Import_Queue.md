# ADR-004_Source_Observations_As_Import_Queue

Status: Proposed

## Context

The initial Milestone 04 design proposed a separate `import_queue`. The
implemented application already uses `source_observations` as its pending intake
and human-review queue. A second queue would duplicate review state and create
competing publication paths.

## Decision

CSV imports will use `source_observations` as the sole pending review queue.
Separate `csv_import_batches` and `csv_import_rows` tables will retain immutable
batch and row audit evidence only. Imported observations will not receive a
production `location_record_id` until approval through the existing review
workflow.

## Rationale

One review queue preserves a single authorization, review, and publication
boundary while the audit tables retain CSV provenance and duplicate outcomes.

## Alternatives Considered

A separate `import_queue` was rejected because it duplicates workflow state.
Direct insertion into `location_records` was rejected because it bypasses human
review. Storing only batch totals was rejected because it loses row provenance.

## Consequences

The existing approval function must support pending observations without a
location record. CSV-specific provenance is added to `source_observations`.
Audit tables remain non-authoritative and cannot publish records.

## Related Records

- `ADR-001_Human_Review_Required.md`
- `ADR-002_Production_Registry_Separation.md`
- `ADR-003_Duplicate_Detection_Strategy.md`
- `Milestone_04_Bulk_Import_Design.md`
