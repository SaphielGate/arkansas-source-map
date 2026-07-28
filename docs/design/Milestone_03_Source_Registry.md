# Milestone 03 - Source Registry Design Specification

**Project:** Arkansas Source Map
**Milestone:** 03
**Version:** 1.0
**Status:** Completed

---

# Purpose

Create the production source registry used by the Arkansas Source Map.

This registry serves as the authoritative data source displayed on the public map.

---

# Objectives

- Build source submission form.
- Store records in Supabase.
- Display records on interactive map.
- Support geospatial visualization.
- Preserve source metadata.
- Enable future investigative expansion.

---

# Data Flow

Administrator

↓

Source Form

↓

Supabase

↓

Production Registry

↓

Map Marker

↓

Interactive Arkansas Map

---

# Registry Principles

The production registry contains only approved records.

Each record represents a verified source location.

Future import pipelines publish into this registry after review.

---

# Production Registry

Stores

- Business Name
- Address
- Coordinates
- Category
- Notes
- Website
- Contact Information

Future versions may include

- Evidence Links
- Confidence Scores
- Review History
- Source Relationships

---

# Map Integration

Approved records automatically appear on the interactive Arkansas map.

The map reads directly from the production registry.

---

# User Experience

Administrator

Create Source

↓

Save

↓

Database

↓

Marker Appears

Public User

Open Map

↓

View Sources

↓

Interact With Markers

---

# Success Criteria

✓ Registry form operational

✓ Database insertion successful

✓ HTTP 201 Created returned

✓ Marker automatically appears

✓ Map refreshes correctly

✓ Production registry operational

---

# Deliverables

- Source registry
- Interactive mapping
- Production data workflow

---

# Lessons Learned

Separating the production registry from future import pipelines creates a scalable architecture capable of supporting large investigative datasets.

---

# Completion Status

Completed

# Dependencies

Requires

- Milestone_01_Foundation
- Milestone_02_Authentication

Enables

- Milestone_04_Bulk_Import_Design
- Milestone_05_Duplicate_Detection
