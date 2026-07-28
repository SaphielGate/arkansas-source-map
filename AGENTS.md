# Project Documentation Requirements

The Arkansas Source Map follows a documentation-first development workflow.

All significant milestones, features, and architectural decisions must be documented in the repository.

## Documentation Locations

Use the following directories:

- `docs/design/` for milestone and feature design specifications
- `docs/adr/` for Architecture Decision Records
- `docs/templates/` for reusable documentation templates

Do not place milestone design specifications inside the ADR directory.

If the repository currently uses different documentation paths, preserve the established paths consistently rather than creating duplicate directory structures.

---

## File Naming Convention

Use underscores between descriptive words.

Use two-digit, zero-padded milestone numbers:

- `Milestone_01_Foundation.md`
- `Milestone_02_Authentication.md`
- `Milestone_03_Source_Registry.md`
- `Milestone_04_Bulk_Import_Design.md`

Use three-digit, zero-padded ADR numbers:

- `ADR-001_Human_Review_Required.md`
- `ADR-002_Production_Registry_Separation.md`
- `ADR-003_Duplicate_Detection_Strategy.md`

Do not mix hyphens and underscores within descriptive file names.

---

## Design Document Requirement

Before implementing a new milestone or major feature:

1. Identify the milestone or feature being implemented.
2. Search `docs/design/` for the corresponding design document.
3. Read the entire design document before changing code.
4. Read all related ADRs referenced by the design document.
5. Confirm that the proposed implementation is consistent with the approved design and ADRs.

If the required design document does not exist:

1. Create it from the repository design-document template.
2. Set its status to `Draft`.
3. Populate it with the proposed purpose, objectives, architecture, data flow, schema requirements, validation rules, security requirements, acceptance criteria, dependencies, and implementation constraints.
4. Do not begin implementation until the design has been reviewed and approved by the project maintainer, unless the user explicitly authorizes design and implementation in the same task.

Design documents describe:

- What is being built
- How the feature should operate
- Required data structures
- User and system workflows
- Security requirements
- Validation behavior
- Acceptance criteria
- Dependencies
- Implementation constraints

Design documents may contain technical blueprints.

---

## Architecture Decision Record Requirement

Create or update an ADR only when the work introduces a significant architectural decision.

An ADR is appropriate when a decision:

- Changes system architecture
- Establishes a lasting data-governance rule
- Affects authentication or authorization
- Affects publication or review boundaries
- Changes the authoritative source of truth
- Introduces a major dependency
- Is difficult or costly to reverse
- Establishes a project-wide engineering rule

Do not create an ADR for routine implementation details, minor UI changes, ordinary bug fixes, or decisions already governed by an accepted ADR.

An ADR must contain only:

- Context
- Decision
- Rationale
- Alternatives Considered
- Consequences
- Related Records

An ADR must not contain:

- Full implementation blueprints
- Complete database schemas
- Endpoint specifications
- UI wireframes
- Step-by-step implementation instructions
- Detailed acceptance criteria
- Test plans

Those details belong in the related design document.

New ADRs must initially use:

```text
Status: Proposed

