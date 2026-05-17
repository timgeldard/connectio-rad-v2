# EnvMon Domain-Driven Design Model

**Date:** 2026-05-17 (m.txt)
**Tranche:** m.txt — EnvMon DDD framing
**Status:** Framing only — Observations BC first safe slice (QuerySpec hardened, route not wired); Spatial Configuration and Spatial Analysis deferred
**References:**
- `docs/migration/envmon-v1-deep-dive.md`
- `docs/audit/envmon-spatial-configuration-model.md`
- `docs/audit/envmon-v1-functional-capability-map.md`
- `docs/migration/envmon-advisor-recommendation.md`
- `docs/migration/envmon-site-summary-native-route-plan.md`

---

## Overview

Environmental Monitoring (EnvMon) is a **hybrid domain** spanning three distinct
bounded contexts. V1 ConnectIO-RAD implemented all three in a single backend, which
is why the domain appeared simple. V2 separates them explicitly:

1. **EnvMon Observations** — read-only from SAP QM inspection lot data in the Databricks
   gold layer. System of record: SAP QM / Databricks ETL.
2. **EnvMon Spatial Configuration** — app-managed Delta tables for floorplans, coordinates,
   zones, and revisions. System of record: EnvMon application (write APIs).
3. **EnvMon Spatial Analysis** — composed read model joining Observations + Spatial
   Configuration. Enables heatmap, zone-level exposure, and drill-through.

This tranche (m.txt) implements the first safe slice of **EnvMon Observations** only.

---

## Bounded Context 1 — EnvMon Observations

### System of record

SAP QM inspection lot and result data, surfaced as read-only Databricks gold views.
V2 has no write path into SAP QM.

### Domain boundary

Inspection types `'14'` and `'Z14'` only (recurring environmental monitoring and hygiene
swabs). Other inspection types are SAP QM scope but not EnvMon scope.

### Aggregate candidates

| Aggregate | Root entity | Notes |
|---|---|---|
| `InspectionLot` | `gold_inspection_lot` (INSPECTION_LOT_ID) | Contains points and results |
| `InspectionPoint` | `gold_inspection_point` (INSPECTION_POINT_ID) | One per sample location per lot |
| `QualityResult` | `gold_batch_quality_result_v` (composite key) | One per MIC characteristic per point |

### Read models (V2 contracts)

| Read model | Source query | Status |
|---|---|---|
| `EnvMonSiteSummary` | Aggregate KPI: total/fail/warn locations per plant per period | QuerySpec written; route not wired (DDL pending) |
| `EnvMonSwabResults` | Detail list: per-location results with valuation | Deferred — after DDL confirmed |
| `EnvMonTrends` | Time-series: positive rate per period | Deferred — requires period-over-period query |
| `EnvMonAlerts` | Derived: lots breaching thresholds | Deferred — alert rules undefined |

### Key business rules (confirmed-v1)

- **Domain filter:** `INSPECTION_TYPE IN ('14', 'Z14')`
- **Valuation mapping:**
  - `R` / `REJ` / `REJECT` → fail (positive result — organism detected)
  - `W` / `WARN` → warning (borderline)
  - `NULL` → pending (no usage decision yet)
  - `A` or other non-null → pass (negative)
- **Join keys:**
  - `gold_inspection_lot` → `gold_inspection_point`: `INSPECTION_LOT_ID`
  - `gold_inspection_point` → `gold_batch_quality_result_v`: `INSPECTION_LOT_ID + OPERATION_ID + SAMPLE_ID`
- **Positive rate semantics:** location-level fraction (fraction of locations with ≥1 fail),
  not sample-level. Matches V1 KPI semantics.

### What this tranche implements

- QuerySpec hardened for `getEnvMonSiteSummary` (LIMIT :max_rows bug fixed → LIMIT 1)
- Route `GET /api/envmon/site-summary` **deferred** — DDL not confirmed in connected_plant_uat
- Tests for QuerySpec and mapper added

### Deferred in Observations BC

- `getEnvMonSwabResults` — Rank 2; after DDL confirmed
- `getEnvMonTrends` — Rank 3
- `getEnvMonAlerts` — Alert rules undefined

---

## Bounded Context 2 — EnvMon Spatial Configuration

### System of record

The EnvMon application itself — five app-managed Delta tables in TRACE_CATALOG / TRACE_SCHEMA.

### Aggregate candidates

| Aggregate | Root entity | Notes |
|---|---|---|
| `PlantSpatialModel` | `em_plant_floor` (plant_id) | One model per plant; has floors |
| `Floorplan` | `em_plant_floor` (floor_id) | A floor with canvas dimensions and background image |
| `FloorplanRevision` | `em_layout_revision` (revision_id) | draft → published → superseded / rolled_back |
| `MonitoringLocationPlacement` | `em_location_coordinates` (func_loc_id + floor_id) | x/y % on canvas |
| `Zone` | `em_location_zones` (zone_id) | Polygon/rectangle with geometry_json |

### Read models

| Read model | Source | Status |
|---|---|---|
| Floor list per plant | `em_plant_floor` | Deferred — em_* existence in UAT unknown |
| Published revision | `em_layout_revision` WHERE state='published' | Deferred |
| Location coordinates | `em_location_coordinates` | Deferred |
| Zone definitions | `em_location_zones` | Deferred |

### Future commands

These commands do not exist in V2 yet. Do not implement in this tranche.

| Command | Description |
|---|---|
| `uploadFloorplan` | Upload background image and create `em_plant_floor` row |
| `createFloorplanRevision` | Create draft revision for a floor |
| `publishFloorplanRevision` | Validate → supersede old → publish → set active_revision_id → bulk-stamp coords |
| `rollbackFloorplanRevision` | Restore previous published revision |
| `placeMonitoringLocation` | Set x/y % for a functional location on a floor |
| `assignLocationToZone` | Set parent_zone_id on a coordinate row |

### Key facts about this BC (confirmed-v1)

- `em_plant_floor.background_image_url` is a plain string — no upload handler found in V1.
  V1 stored externally-hosted URLs. Upload workflow is out of V1 scope.
- `em_layout_revision.state` lifecycle: `draft` → `published` → `superseded` / `rolled_back`
- `em_location_zones` has NO `hygiene_zone` or `area_type` columns in V1 DDL. These V2
  contract fields require new schema design.
- `getEnvMonCorrectiveActions` has no source in V1 at all — no CAPA tables, routes, or code.

### Existence in UAT

**Unknown.** Run before designing any feature:
```sql
SHOW TABLES IN connected_plant_uat.gold LIKE 'em_%';
```

If tables exist: update `docs/audit/envmon-spatial-configuration-model.md`.
If not: these tables are confirmed-v1 from V1 migrations but not yet deployed to UAT.

---

## Bounded Context 3 — EnvMon Spatial Analysis

### System of record

Composed read model — joins Observations (BC1) + Spatial Configuration (BC2).

### When this BC can be implemented

Only after:
1. Group A DDL confirmed (BC1 route wired and browser-verified)
2. em_* tables confirmed present in connected_plant_uat (BC2 tables exist)

### Read models

| Read model | Source query | Status |
|---|---|---|
| `EnvMonHeatmap` | lot + point + result_v JOIN em_location_coordinates + em_plant_floor | Deferred — em_* existence unknown |
| `EnvMonZones` | em_location_zones (+ optional lot join for zone-level pass/fail) | Deferred — em_* existence unknown |
| `criticalZoneExposures` | em_location_zones JOIN point/result | Deferred — em_* existence unknown |

---

## What this tranche (m.txt) delivers

| Deliverable | Status |
|---|---|
| DDD framing document (this file) | Created |
| QuerySpec hardened (LIMIT 1 fix) | Done |
| QuerySpec + mapper tests | Added |
| Route plan document | Created |
| DDL verification checklist updated | Updated |
| Browser verification checklist updated | Updated |
| Matrix docs updated | Updated |
| Route `GET /api/envmon/site-summary` | **NOT WIRED** — DDL not confirmed (deliberate stop) |
| Frontend wiring | **NOT DONE** — depends on route |
| Spatial Configuration (BC2) | Deferred |
| Spatial Analysis (BC3) | Deferred |

---

## What remains deferred

| Feature | Blocked by |
|---|---|
| Route wiring | Group A DDL not confirmed |
| getEnvMonSwabResults | Group A DDL not confirmed |
| getEnvMonTrends | Group A DDL; period-over-period query not designed |
| getEnvMonAlerts | Alert rules undefined |
| getEnvMonZones | em_* existence in UAT unknown |
| getEnvMonHeatmap | em_* existence unknown + spatial coordinate placement |
| criticalZoneExposures (real value) | em_location_zones existence + zone classification schema |
| openCorrectiveActions | No CAPA source in V1; new data source required |
| trendDirection (real value) | Period-over-period query not implemented |
| Floorplan upload | No V1 upload handler; new command API required |
| L4/hygiene zoning | hygiene_zone/area_type not in V1 DDL; new schema design required |
| CAPA/corrective actions | No source in V1 at all |

---

## Architecture guardrails (non-negotiable)

- No SQL in React
- No SQL in FastAPI route handlers
- No SPN/PAT fallback for user-facing reads
- No silent fallback from databricks-api to mock or legacy-api
- No invented field values
- No placeholder values treated as factual business data
