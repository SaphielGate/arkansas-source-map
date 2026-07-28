# ADR-003 — Duplicate Detection Strategy

**Project:** Arkansas Source Map  
**Status:** Accepted  
**Date:** 2026-07-24  
**Related Design:** `Milestone_04_Bulk_Import_Design.md`

---

## Context

Bulk imports may contain records that refer to businesses or locations already present in the production registry or import queue.

Duplicate records may not be exact textual matches. Business names, addresses, phone numbers, URLs, and coordinates may contain differences in spelling, abbreviations, capitalization, punctuation, or formatting.

At the same time, records with similar names or addresses may represent separate businesses, different suites, historical occupants, or distinct observations.

Automatic duplicate merging could therefore remove meaningful information or combine unrelated records.

---

## Decision

Duplicate detection will be advisory and subject to human review.

The system may identify records as possible duplicates and present the reasons for the match. It will not automatically merge, delete, reject, or overwrite records.

An authorized administrator will make the final duplicate determination.

Confirmed duplicates will remain preserved in the import queue for audit purposes and will not create an additional production record.

---

## Rationale

Human-reviewed duplicate detection:

- Reduces repetitive manual searching.
- Protects against false automatic merges.
- Preserves potentially meaningful distinctions.
- Keeps duplicate decisions explainable and auditable.
- Allows the matching strategy to improve over time.

The project prioritizes avoiding false merges over aggressive automatic consolidation.

---

## Alternatives Considered

### Exact-Match Detection Only

Rejected as the sole strategy because formatting and spelling variations would cause many duplicates to be missed.

Exact matching may still be used as one duplicate signal.

### Automatic Merge Above a Similarity Threshold

Rejected because similar records may represent separate entities, suites, historical occupants, or related businesses.

### Fully Manual Duplicate Review

Rejected because reviewers would need to search the entire registry for every imported record, reducing efficiency and increasing the likelihood of missed duplicates.

### Machine-Learning-Only Detection

Deferred because the initial strategy should remain transparent, explainable, and easy to audit.

---

## Consequences

### Positive

- Reviewers receive assistance identifying possible duplicates.
- No record is merged without human judgment.
- Original imported information remains preserved.
- Duplicate decisions can be audited.
- Historical and same-address distinctions can remain separate.
- Detection logic can evolve without changing the core review principle.

### Tradeoffs

- Human review remains necessary.
- Some duplicates may not be detected.
- Some distinct records may be flagged for review.
- Matching thresholds may require adjustment as the registry grows.
- Duplicate analysis adds processing and application complexity.

These tradeoffs are accepted because investigative records require cautious and reversible duplicate handling.

---

## Related Records

- `ADR-001_Human_Review_Required.md`
- `ADR-002_Production_Registry_Separation.md`
- `Milestone_03_Source_Registry.md`
- `Milestone_04_Bulk_Import_Design.md`
