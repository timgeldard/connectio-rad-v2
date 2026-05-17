# EnvMon V1 Functional Capability Map

**Date:** 2026-05-17
**Tranche:** l.txt
**Domain:** Environmental Monitoring (EnvMon)
**Purpose:** Authoritative record of every V1 capability, its data sources, and its current V2 parity status. Use this as the reference when prioritising EnvMon implementation work.

---

## Legend

| Column | Meaning |
|---|---|
| Exists in V1 | Whether V1 implements this capability at all |
| UI evidence | V1 frontend components that render this capability |
| Route / API evidence | V1 FastAPI routes that serve this capability |
| Data-source evidence | Confirmed-v1 tables / views that back this capability |
| Source files | Key V1 source files |
| V2 equivalent | V2 adapter method or design decision |
| V2 parity status | Current state of V2 implementation |
| Migration priority | Relative priority for V2 implementation |
| Blockers | What must be resolved before V2 can deliver parity |

---

## 1. Site Summary / Plant Overview

| Attribute | Detail |
|---|---|
| Exists in V1 | YES |
| UI evidence | `GlobalView.tsx` — plant-level KPI cards |
| Route / API evidence | `GET /api/em/plants` — returns portfolio KPIs including lot counts, fail counts, active locations |
| Data-source evidence | `gold_inspection_lot`, `gold_inspection_point`, `gold_batch_quality_result_v` (all confirmed-v1) |
| Source files | `inspection_analysis/router.py`, `inspection_analysis/plants.py` |
| V2 equivalent | `getEnvMonSiteSummary` → `EnvMonSiteSummary` |
| V2 parity status | PARTIAL — QuerySpec written, DDL verification pending for all three gold views |
| Migration priority | HIGH — first executable slice; no app-managed table dependency |
| Blockers | DDL confirmation for `gold_inspection_lot`, `gold_inspection_point`, `gold_batch_quality_result_v` in `connected_plant_uat` |

---

## 2. Swab or Inspection Result List

| Attribute | Detail |
|---|---|
| Exists in V1 | YES |
| UI evidence | `LocationPanel.tsx` → `LotsTab` renders lot list per location |
| Route / API evidence | `GET /api/em/lots` — inspection lots for a location; `GET /api/em/lots/{lot_id}` — individual lot MIC results |
| Data-source evidence | `gold_inspection_lot`, `gold_inspection_point`, `gold_batch_quality_result_v` (all confirmed-v1) |
| Source files | `inspection_analysis/router.py`, `inspection_analysis/lots.py` |
| V2 equivalent | `getEnvMonSwabResults` → `EnvMonSwabResult[]` |
| V2 parity status | PARTIAL — mock only, no route wired; most fields mappable from SAP QM once DDL confirmed |
| Migration priority | HIGH — Rank 2 after site summary DDL confirmed |
| Blockers | DDL confirmation for the three gold views (same dependency as site summary) |

---

## 3. Trend View

| Attribute | Detail |
|---|---|
| Exists in V1 | YES |
| UI evidence | `LocationPanel.tsx` → `TrendTab` renders MIC time-series chart |
| Route / API evidence | `GET /api/em/trends` — MIC time-series; `GET /api/em/mics` — distinct MIC names |
| Data-source evidence | `gold_inspection_lot`, `gold_inspection_point`, `gold_batch_quality_result_v` (all confirmed-v1) |
| Source files | `inspection_analysis/router.py`, `inspection_analysis/trends.py` |
| V2 equivalent | `getEnvMonTrends` → `EnvMonTrend[]` |
| V2 parity status | MOCK — contract has fields with no SAP QM source (newAlerts, resolvedAlerts, openAlerts, complianceRate); alert counts MUST NOT default to 0 as if factual |
| Migration priority | MEDIUM — Rank 3; same gold views as site summary |
| Blockers | DDL confirmation for the three gold views; alert derivation rules undefined |

---

## 4. Alerts / Fails / Warnings

| Attribute | Detail |
|---|---|
| Exists in V1 | YES (derived, not first-class) |
| UI evidence | `GlobalView.tsx` KPI cards show fail counts; `FloorPlan.tsx` → `Marker.tsx` uses marker colours to indicate risk/SPC fail |
| Route / API evidence | `GET /api/em/plants` KPI response includes active_fails count; `GET /api/em/heatmap` includes INSPECTION_RESULT_VALUATION per marker |
| Data-source evidence | `gold_batch_quality_result_v.INSPECTION_RESULT_VALUATION` (R/REJ/REJECT = fail; WARN = warning) — confirmed-v1 |
| Source files | `inspection_analysis/plants.py`, `inspection_analysis/heatmap.py` |
| V2 equivalent | `getEnvMonAlerts` → `EnvMonAlert[]` |
| V2 parity status | MOCK — alert derivation rules (threshold, escalation, alert lifecycle) undefined; V1 had no persistent alert records |
| Migration priority | MEDIUM — deferred until alert derivation rules are agreed |
| Blockers | Alert derivation rules (what constitutes an alert vs. a fail); `alertId` synthetic generation strategy; `correctiveActionId` has no source |

---

## 5. Floorplan Maintenance

| Attribute | Detail |
|---|---|
| Exists in V1 | YES |
| UI evidence | `SpatialStudio.tsx`, `StudioCanvas.tsx` — admin UI for floor CRUD |
| Route / API evidence | `spatial_config/router.py` — CRUD endpoints for `/api/em/floors` (create, update, delete floor records) |
| Data-source evidence | `em_plant_floor` (confirmed-v1; existence in UAT unknown) |
| Source files | `spatial_config/router.py`, `spatial_config/floors.py` |
| V2 equivalent | No direct V2 adapter method — admin configuration panel not designed |
| V2 parity status | NOT DESIGNED |
| Migration priority | HIGH for full V1 parity — configuration panel must exist for operators to manage floorplans |
| Blockers | `em_plant_floor` existence in `connected_plant_uat` unconfirmed; admin panel design not started |

---

## 6. Floorplan / Map Image Upload

| Attribute | Detail |
|---|---|
| Exists in V1 | PARTIAL |
| UI evidence | `StudioCanvas.tsx` — renders `background_image_url` as a background image on the canvas |
| Route / API evidence | No upload handler found in V1 repository — `background_image_url` is stored as a plain string column; image hosting appears external |
| Data-source evidence | `em_plant_floor.background_image_url` (VARCHAR column; confirmed-v1 schema, UAT existence unknown) |
| Source files | `spatial_config/router.py`, `spatial_config/floors.py` |
| V2 equivalent | NOT DESIGNED — no image upload method in V2 adapter |
| V2 parity status | NOT DESIGNED |
| Migration priority | BLOCKED |
| Blockers | Image storage provider unknown; no upload handler identified in V1; cannot replicate without knowing where images are hosted and how URLs are generated |

---

## 7. Multiple Floorplans per Plant

| Attribute | Detail |
|---|---|
| Exists in V1 | YES |
| UI evidence | `SiteView.tsx` — floor selector rail; `HierarchyRail.tsx` — lists floors by sort order |
| Route / API evidence | `GET /api/em/floors` — returns floors for a plant; `em_plant_floor` has `plant_id + floor_id` composite PK with `sort_order` column |
| Data-source evidence | `em_plant_floor` (confirmed-v1; `sort_order` column confirmed) |
| Source files | `spatial_config/router.py` |
| V2 equivalent | `getEnvMonZones` → `EnvMonZone[]` references `floorId` field in contract |
| V2 parity status | PARTIAL — `floorId` present in contract but source blocked pending `em_plant_floor` existence confirmation in UAT |
| Migration priority | MEDIUM — dependency of heatmap parity |
| Blockers | `em_plant_floor` existence in `connected_plant_uat` unconfirmed |

---

## 8. Active Floorplan / Revision Selection

| Attribute | Detail |
|---|---|
| Exists in V1 | YES |
| UI evidence | `SpatialStudio.tsx` — revision history panel; `PublishDialog.tsx` — promote draft to published |
| Route / API evidence | `studio_router.py` — `/api/em/spatial/draft`, `/api/em/spatial/publish`, `/api/em/spatial/rollback`, revision history endpoint |
| Data-source evidence | `em_plant_floor.active_revision_id` FK → `em_layout_revision`; revision states: `draft`, `published`, `superseded`, `rolled_back` (all confirmed-v1) |
| Source files | `spatial_config/studio_router.py`, `spatial_config/revisions.py` |
| V2 equivalent | No active-revision selection method in V2 adapter |
| V2 parity status | NOT DESIGNED |
| Migration priority | MEDIUM — needed for heatmap parity (must know which revision's coordinates to display) |
| Blockers | `em_layout_revision` and `em_plant_floor` existence in UAT unconfirmed; admin panel design not started |

---

## 9. Functional-Location Coordinate Placement

| Attribute | Detail |
|---|---|
| Exists in V1 | YES |
| UI evidence | `StudioCanvas.tsx` → `PointLayer.tsx` — drag-and-drop placement of inspection point markers; `InspectorPanel.tsx` — coordinate editor |
| Route / API evidence | `spatial_config/router.py` — `GET /api/em/locations` (functional locations with mapping status), coordinate update endpoint |
| Data-source evidence | `em_location_coordinates` with `x_pos`, `y_pos` per `func_loc_id` (confirmed-v1 schema; UAT existence unknown) |
| Source files | `spatial_config/router.py`, `spatial_config/coordinates.py` |
| V2 equivalent | `getEnvMonHeatmap` requires coordinates; no coordinate placement method in V2 adapter |
| V2 parity status | BLOCKED — heatmap cannot display without `x_pos`/`y_pos` from `em_location_coordinates` |
| Migration priority | HIGH for heatmap parity — coordinate data is the spatial backbone of the heatmap view |
| Blockers | `em_location_coordinates` existence in `connected_plant_uat` unconfirmed |

---

## 10. L4 / Hygiene Zone Maintenance

| Attribute | Detail |
|---|---|
| Exists in V1 | YES (as generic L4 spatial zones — NOT as hygiene/area classification) |
| UI evidence | `ZoneLayer.tsx` — renders zone polygons; `ValidationPanel.tsx` — validates zone coverage; `SpatialStudio.tsx` — zone authoring workflow |
| Route / API evidence | `studio_router.py` zones CRUD — `/api/em/spatial/zones`; zones have `zone_name`, `geometry_type`, associated `functional_location_id` (L4 level) |
| Data-source evidence | `em_location_zones` with L4 `functional_location_id` + `zone_name` + geometry (confirmed-v1 schema; UAT existence unknown) |
| Source files | `spatial_config/studio_router.py`, `spatial_config/zones.py` |
| V2 equivalent | `getEnvMonZones` → `EnvMonZone[]` |
| V2 parity status | PARITY GAP — V2 contract adds `hygieneZone` (zone-1/2/3/4) and `areaType` (production/storage/packaging/utility/corridor/other); V1 zones are generic L4 spatial areas with `zone_name` and geometry only; there is NO hygiene classification in V1 |
| Migration priority | HIGH gap — these fields are OVERDESIGNED relative to V1; adding them requires a new zone classification table or an extension of `em_location_zones` |
| Blockers | `em_location_zones` existence in UAT unconfirmed; `hygieneZone` / `areaType` classification logic undefined; no V1 source for these fields |

---

## 11. Heatmap / Spatial Result Display

| Attribute | Detail |
|---|---|
| Exists in V1 | YES |
| UI evidence | `FloorView.tsx` → `FloorPlan.tsx` → `Marker.tsx` + `Tooltip.tsx` — spatial heatmap of inspection points coloured by risk/SPC status |
| Route / API evidence | `GET /api/em/heatmap` — heatmap markers with risk score, SPC status, and coordinates |
| Data-source evidence | `gold_inspection_lot` + `gold_inspection_point` + `gold_batch_quality_result_v` (confirmed-v1) + `em_location_coordinates` + `em_plant_floor` (confirmed-v1 schema; UAT existence unknown) |
| Source files | `inspection_analysis/heatmap.py`, `spatial_config/floors.py` |
| V2 equivalent | `getEnvMonHeatmap` → `EnvMonHeatmapCell[]` |
| V2 parity status | BLOCKED — requires `em_location_coordinates` + `em_plant_floor` + `em_location_zones` |
| Migration priority | HIGH for V1 parity — flagship visual feature of EnvMon |
| Blockers | `em_location_coordinates`, `em_plant_floor`, and `em_location_zones` existence in `connected_plant_uat` all unconfirmed; V2 contract is zone-aggregate level whereas V1 heatmap was point-level (design mismatch — see File 2) |

---

## 12. Corrective Actions / CAPA

| Attribute | Detail |
|---|---|
| Exists in V1 | NOT IN V1 |
| UI evidence | None found |
| Route / API evidence | No CAPA routes in `inspection_analysis/router.py` or `spatial_config/router.py` |
| Data-source evidence | No CAPA tables identified in V1 schema; no gold view for corrective actions |
| Source files | None |
| V2 equivalent | `getEnvMonCorrectiveActions` → `EnvMonCorrectiveAction[]` |
| V2 parity status | ZERO — contract is entirely speculative; no V1 behaviour to replicate |
| Migration priority | NOT IN V1 — requires new design before implementation; do not implement until CAPA workflow is designed and a data source is identified |
| Blockers | No data source; no V1 precedent; CAPA business workflow undefined |

---

## 13. Drill-Through from Map Point to Result / Inspection Lot

| Attribute | Detail |
|---|---|
| Exists in V1 | YES |
| UI evidence | `FloorPlan.tsx` → `Marker.tsx` click → `LocationPanel.tsx` → `LotsTab` + `TrendTab` |
| Route / API evidence | `GET /api/em/locations/{func_loc_id}/summary` — location detail including lot history and trend |
| Data-source evidence | `gold_inspection_lot`, `gold_inspection_point`, `gold_batch_quality_result_v` (all confirmed-v1) |
| Source files | `inspection_analysis/router.py`, `inspection_analysis/locations.py` |
| V2 equivalent | No direct equivalent adapter method — V2 has `getEnvMonSwabResults` and `getEnvMonTrends` but no combined location-drill-through method |
| V2 parity status | NOT DESIGNED as a combined method; may be assembled from `getEnvMonSwabResults` + `getEnvMonTrends` filtered by location |
| Migration priority | MEDIUM — dependent on swab results and trends implementation |
| Blockers | Requires swab results and trends DDL to be confirmed; heatmap interaction design needed |

---

## 14. Plant / Date / Type Filters

| Attribute | Detail |
|---|---|
| Exists in V1 | YES |
| UI evidence | `GlobalView.tsx`, `SiteView.tsx`, `FloorView.tsx` — all have plant selector and date range picker; `LocationPanel.tsx` has MIC type filter |
| Route / API evidence | All `GET /api/em/*` routes accept `plant_id` and date range parameters; `/api/em/trends` and `/api/em/lots` also accept MIC name filter |
| Data-source evidence | Filters applied at query layer against `gold_inspection_lot.PLANT_ID` and date columns |
| Source files | All `inspection_analysis/` modules |
| V2 equivalent | All adapter request types include `plantId`, `periodStart`, `periodEnd`; some include `micName` / `testType` |
| V2 parity status | GOOD — filter contract matches V1 behaviour; no gaps identified |
| Migration priority | LOW — already correct in contract; no additional work needed |
| Blockers | None |

---

## 15. Admin / Configuration Workflows

| Attribute | Detail |
|---|---|
| Exists in V1 | YES |
| UI evidence | `SpatialStudio.tsx`, `StudioCanvas.tsx`, `ZoneLayer.tsx`, `PointLayer.tsx`, `PublishDialog.tsx`, `ValidationPanel.tsx` — full Spatial Studio workflow |
| Route / API evidence | `studio_router.py` — draft, publish, validate, rollback, zones CRUD, revision history; `spatial_config/router.py` — plant-geo, floors CRUD |
| Data-source evidence | `em_plant_floor`, `em_location_coordinates`, `em_location_zones`, `em_layout_revision`, `em_plant_geo` (all confirmed-v1 schema; UAT existence unknown) |
| Source files | `spatial_config/studio_router.py`, `spatial_config/router.py` |
| V2 equivalent | No admin panel designed in V2 |
| V2 parity status | NOT DESIGNED |
| Migration priority | BLOCKED until spatial tables confirmed in `connected_plant_uat` |
| Blockers | All five app-managed tables (`em_plant_floor`, `em_location_coordinates`, `em_location_zones`, `em_layout_revision`, `em_plant_geo`) existence in UAT unconfirmed; admin panel design not started; image upload storage unknown |

---

## Summary Table

| # | Capability | Exists in V1 | V2 parity status | Priority |
|---|---|---|---|---|
| 1 | Site summary / plant overview | YES | PARTIAL — QuerySpec written, DDL pending | HIGH |
| 2 | Swab / inspection result list | YES | PARTIAL — mock only | HIGH |
| 3 | Trend view | YES | MOCK (alert fields overdesigned) | MEDIUM |
| 4 | Alerts / fails / warnings | YES (derived) | MOCK — derivation rules undefined | MEDIUM |
| 5 | Floorplan maintenance | YES | NOT DESIGNED | HIGH |
| 6 | Floorplan / map image upload | PARTIAL (URL stored, no handler) | NOT DESIGNED | BLOCKED |
| 7 | Multiple floorplans per plant | YES | PARTIAL — `floorId` in contract, source blocked | MEDIUM |
| 8 | Active floorplan / revision selection | YES | NOT DESIGNED | MEDIUM |
| 9 | Functional-location coordinate placement | YES | BLOCKED — `em_location_coordinates` needed | HIGH |
| 10 | L4 / hygiene zone maintenance | YES (generic zones, no hygiene classification) | PARITY GAP — V2 contract overdesigned | HIGH gap |
| 11 | Heatmap / spatial result display | YES | BLOCKED — `em_*` tables needed | HIGH |
| 12 | Corrective actions / CAPA | NOT IN V1 | ZERO — no V1 source | NOT IN V1 |
| 13 | Drill-through: map point → result | YES | NOT DESIGNED as combined method | MEDIUM |
| 14 | Plant / date / type filters | YES | GOOD — contract matches V1 | LOW |
| 15 | Admin / configuration workflows | YES (full Spatial Studio) | NOT DESIGNED | BLOCKED |
