# ADR-001 — Human Review Required

## Status

Accepted

## Context

The Arkansas Source Map will support bulk imports from structured datasets.

Publishing imported records directly to the production registry risks introducing inaccurate, duplicate, or malformed records.

## Decision

All imported records will enter an intermediate staging table (import_queue).

Records must be reviewed and approved by an authenticated administrator before being copied into the production registry.

## Consequences

Benefits

- Protects data integrity.
- Preserves investigative methodology.
- Creates a complete audit trail.
- Allows duplicate detection before publication.

Tradeoffs

- Requires manual review.
- Slightly increases processing time.

This tradeoff is accepted because investigative accuracy is prioritized over import speed.
