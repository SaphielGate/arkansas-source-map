# ADR-002 — Production Registry Separation

**Project:** Arkansas Source Map  
**Status:** Accepted  
**Date:** 2026-07-24  
**Related Design:** `Milestone_04_Bulk_Import_Design.md`

---

## Context

The Arkansas Source Map uses a production registry as the authoritative source for records displayed on the map.

Bulk imports may contain incomplete, malformed, duplicated, outdated, or unverified records. Allowing imported records to enter the production registry immediately could compromise data quality and cause unreviewed information to appear on the map.

The project requires a clear boundary between imported data awaiting review and approved data authorized for publication.

---

## Decision

Imported records will be stored in a separate staging area before publication.

The import queue and the production registry will remain separate.

The import queue will contain records awaiting administrative review. The production registry will contain only records approved for publication.

The Arkansas Source Map will continue to display records exclusively from the production registry.

No imported record may enter the production registry without human approval.

---

## Rationale

Separating staging data from production data:

- Protects the integrity of the published registry.
- Prevents accidental publication of unreviewed records.
- Preserves imported records for auditing.
- Supports correction, rejection, and duplicate review.
- Maintains a clear distinction between collected data and approved data.

Investigative accuracy is prioritized over immediate publication speed.

---

## Alternatives Considered

### Import Directly Into the Production Registry

Rejected because unreviewed records could become publicly visible or contaminate the authoritative dataset.

### Store Pending and Approved Records in One Table

Rejected because it weakens the boundary between staging and production data and increases the risk of pending records being exposed through application queries or policy errors.

### Retain Only the Original Uploaded File

Rejected because record-level review, correction, duplicate assessment, and audit tracking would be inefficient.

---

## Consequences

### Positive

- The production registry remains authoritative.
- Unreviewed records cannot appear on the map.
- Original imported data can be preserved.
- Administrative decisions remain auditable.
- Future data sources can use the same review process.

### Tradeoffs

- Approved information may exist in both staging and production contexts.
- The approval workflow requires additional application logic.
- Imported records require human review before publication.
- Traceability must be maintained between imported and production records.

These tradeoffs are accepted because preserving data integrity is a core project requirement.

---

## Related Records

- `ADR-001_Human_Review_Required.md`
- `ADR-003_Duplicate_Detection_Strategy.md`
- `Milestone_03_Source_Registry.md`
- `Milestone_04_Bulk_Import_Design.md`
