# EnvMon V2 Migration — Advisor Recommendation

**Date:** 2026-05-17
**Tranche:** l.txt — post spatial-config recovery
**Perspective:** Senior manufacturing quality / environmental monitoring product advisor

> **Status update (n.txt, 2026-05-17):** CAPA/corrective actions have been formally scoped out of EnvMon V2 parity.
> `getEnvMonCorrectiveActions` is intentionally not migrated — not blocked, not deferred. The CAPA risk items
> and recommendations below are preserved as historical analysis context; the scope decision supersedes them.
> Future CAPA capability belongs to a separate Quality Actions / Deviation / CAPA bounded context.
**References:**
- `docs/migration/envmon-v1-deep-dive.md`
- `docs/migration/envmon-v1-functional-recovery.md`
- `docs/migration/envmon-native-candidate-ranking.md`
- `docs/audit/envmon-sap-qm-source-model.md`

---

## Framing

EnvMon V1 was fully operational. It delivered: a portfolio KPI view, per-plant floor plan heatmaps, MIC trend charts, lot/result drill-through, and a full Spatial Studio for zone/coordinate authoring with a revision and publish lifecycle.

V2 starts from a mock-only state. The migration question is not "what do we need to design?" — V1 answered most of that. The migration question is "what infrastructure dependencies must be confirmed before each workstream can start, and what are the honest stop conditions?"

This recommendation organises migration into four workstreams with explicit V1 evidence, current V2 status, required data objects, risk, and sequencing.

---

## Workstream A — SAP QM Monitoring Data

*Site summary, swab results, trends, alerts and fails*

### V1 Evidence

V1 `inspection_analysis/dal/` implements the full analytical stack: portfolio KPIs (`plants.py`), floor-level heatmap data (`heatmap.py`), MIC time-series (`trends.py`), lot listing and MIC detail (`lots.py`). All queries use only three gold views: `gold_inspection_lot`, `gold_inspection_point`, `gold_batch_quality_result_v`. No app-managed tables are joined in the KPI, trends, or lot-detail paths.

Source filter: `INSPECTION_TYPE IN ('14','Z14')`. Valuation mapping: `R/REJ/REJECT` → fail, `W/WARN` → warning, NULL → pending, `A` or other → pass.

Join keys are three-column composite for result data: `INSPECTION_LOT_ID + OPERATION_ID + SAMPLE_ID`.

### V2 Current Status

- `getEnvMonSiteSummary`: QuerySpec written, confirmed-v1. No route wired. DDL not yet run.
- `getEnvMonSwabResults`: QuerySpec not yet written. Deferred until site summary DDL confirmed.
- `getEnvMonTrends`: QuerySpec not yet written. Deferred.
- `getEnvMonAlerts`: No V1 "alert" concept — alerts would be derived from failing valuations. Alert rules (severity classification, `alertType` enum) are undefined. Deferred.
- `getEnvMonCorrectiveActions`: No CAPA source in gold layer or app-managed tables. Blocked — no source.

### Required Data Objects

- `gold_inspection_lot` (confirmed-v1): `INSPECTION_LOT_ID`, `PLANT_ID`, `INSPECTION_TYPE`, `CREATED_DATE`, `INSPECTION_END_DATE`
- `gold_inspection_point` (confirmed-v1): `INSPECTION_LOT_ID`, `INSPECTION_POINT_ID`, `FUNCTIONAL_LOCATION`, `OPERATION_ID`, `SAMPLE_ID`
- `gold_batch_quality_result_v` (confirmed-v1): `INSPECTION_LOT_ID`, `OPERATION_ID`, `SAMPLE_ID`, `MIC_NAME`, `INSPECTION_RESULT_VALUATION`, `QUANTITATIVE_RESULT`, `UPPER_TOLERANCE`, `LOWER_TOLERANCE`

### Risk

| Risk | Severity | Mitigation |
|---|---|---|
| Gold views may have different column names in connected_plant_uat | High | DESCRIBE TABLE before wiring any route |
| `IN ('14','Z14')` may return zero rows in UAT | Medium | `SELECT DISTINCT INSPECTION_TYPE` before claiming coverage |
| `openCorrectiveActions` / `overdueActions` default to 0 | High | These fields are misleading at zero — mark as placeholder or make optional in contract until CAPA source is identified |
| `trendDirection` defaulting to `'stable'` | High | A hardcoded default is not analytics — implement it from `getEnvMonTrends` or make the field optional |
| Alert derivation rules undefined | Medium | Do not implement `getEnvMonAlerts` until domain owner defines the severity → `alertType` mapping |
| CAPA workflow does not exist in V1 | Critical | `getEnvMonCorrectiveActions` requires a full new workflow design — do not stub with zeros |

### Recommended Next Tranche

1. Run `DESCRIBE TABLE` for all three gold views in connected_plant_uat SQL Editor
2. Run `SELECT DISTINCT INSPECTION_TYPE FROM gold_inspection_lot LIMIT 100` — confirm `'14'` and `'Z14'` are present
3. Run `SELECT DISTINCT INSPECTION_RESULT_VALUATION FROM gold_batch_quality_result_v LIMIT 50` — confirm valuation values
4. Update `docs/audit/envmon-native-column-verification-checklist.md` to `confirmed-ddl`
5. Wire `GET /api/envmon/site-summary`
6. Browser-verify in UAT
7. Write QuerySpec for `getEnvMonSwabResults` and wire route
8. Write QuerySpec for `getEnvMonTrends` and wire route

### Stop Conditions

- Do not wire any route before DDL confirmed.
- Do not implement `getEnvMonAlerts` until alert derivation rules are defined by the domain owner.
- Do not implement `getEnvMonCorrectiveActions` at all in the short term — this requires CAPA workflow design that is not a V1 migration problem.

---

## Workstream B — Spatial Configuration

*Floorplans, background image, revision lifecycle, coordinate placement, L4 zones*

### V1 Evidence

V1 `spatial_config/` sub-module implements a complete CRUD and Studio workflow. Five app-managed Delta tables are fully DDL-confirmed from V1 migration scripts 001b–007: `em_location_coordinates`, `em_plant_floor`, `em_plant_geo`, `em_layout_revision`, `em_location_zones`. The revision lifecycle (`draft → published → superseded / rolled_back`) and the 5-step publish workflow are fully implemented and confirmed-v1.

The entire sub-module was functionally complete in V1.

### V2 Current Status

No spatial configuration adapter, routes, or contracts have been implemented in V2. The `em_*` tables have not been confirmed to exist in `connected_plant_uat` — this is the single blocking uncertainty for this entire workstream.

### Required Data Objects

All five em_* tables (see `docs/migration/envmon-v1-deep-dive.md` Section B for full column lists):
- `em_location_coordinates` — coordinate placement per functional location
- `em_plant_floor` — floor plan metadata and canvas config
- `em_plant_geo` — plant geographic coordinates
- `em_layout_revision` — revision lifecycle table
- `em_location_zones` — zone geometry boundaries

### Risk

| Risk | Severity | Mitigation |
|---|---|---|
| em_* tables may not exist in connected_plant_uat | Critical | Run `SHOW TABLES IN connected_plant_uat.gold LIKE 'em_%'` before any implementation — if not present, workstream B is fully blocked |
| em_* tables exist but were never populated | High | Row count check after existence confirmed — empty tables still block heatmap parity |
| `hygieneZone` / `areaType` in V2 contracts have no V1 source | High | V1 zones are generic L4 spatial areas only — they have no hygiene classification field. These V2 contract fields require new zone classification design and cannot be backfilled from V1 data. Mark as `null` or design optional until classification scheme is defined. |
| Background image upload is an unresolved design gap | High | No V1 upload handler found — image hosting solution is unknown. Do not implement a V2 upload workflow until hosting target is clarified with V1 deployment team |
| Revision lifecycle has complex state transitions | Medium | The 5-step publish workflow must be transactional — a partial failure (e.g. coordinates bulk-stamp fails) must not leave the revision in a published state with incorrect parent_zone_id stamps |

### Recommended Next Tranche

1. Run `SHOW TABLES IN connected_plant_uat.gold LIKE 'em_%'` — this is the gate for the entire workstream
2. If tables exist: row count and sample query for `em_plant_floor`, `em_location_coordinates`
3. If tables populated: implement read-only floor plan list adapter (`getEnvMonFloors`)
4. Implement read-only coordinate list adapter (`getEnvMonCoordinates`)
5. Implement read-only zone list adapter (`getEnvMonZones`) — noting that `hygieneZone` / `areaType` will be null/absent until classification design is complete
6. Only then implement write/CRUD paths (requires additional auth and admin role design)

### Stop Conditions

- Do not implement any B workstream adapter if `SHOW TABLES` confirms em_* tables do not exist.
- Do not implement a background image upload handler until hosting solution is identified.
- Do not populate `hygieneZone` or `areaType` from V1 zone data — these fields are a new design problem.

---

## Workstream C — Spatial Visualisation

*Heatmap rendering, zone exposure, point drill-through, status overlays*

### V1 Evidence

V1 `heatmap.py` implements the full multi-join query for heatmap rendering. `FloorPlan.tsx`, `Marker.tsx`, and `Tooltip.tsx` implement the client-side rendering. The heatmap join requires all three gold views (valuation data) plus `em_location_coordinates` (x/y positions) and `em_plant_floor` (canvas dimensions). The colour model is simple: worst-case valuation per `FUNCTIONAL_LOCATION` in the period window.

No riskScore algorithm found in V1. Visual classification only.

### V2 Current Status

`getEnvMonHeatmap` is mock-only. Blocked on both DDL confirmation of gold views (Workstream A) and em_* table confirmation (Workstream B).

### Required Data Objects

All data objects from Workstream A plus:
- `em_location_coordinates` (for x_pos, y_pos per func_loc_id)
- `em_plant_floor` (for canvas_width, canvas_height, background_image_url)

### Risk

| Risk | Severity | Mitigation |
|---|---|---|
| Blocked by both Workstream A and B | Critical | Heatmap is the last slice to implement, not the first — despite being the flagship visual |
| V2 contract field `riskScore` has no V1 source | High | V1 has no numeric risk score — only valuation classification. If V2 contract exposes `riskScore`, it must be implemented with new business rules or removed |
| Canvas coordinate mismatch | Medium | x_pos/y_pos are stored as percentage of original SVG dimensions — rendering must account for `canvas_units` (pct vs px) from migration 006 columns |
| Empty or zero-row em_location_coordinates | High | If no coordinates have been set in UAT, all markers will be absent — confirm at least some plants have coordinate data before claiming parity |

### Recommended Next Tranche

Implement only after Workstreams A and B are both at route-wired and browser-verified status:

1. Implement `getEnvMonHeatmap` QuerySpec using confirmed column names from both DDL checks
2. Wire `GET /api/envmon/heatmap`
3. Browser-verify with a plant that has populated `em_location_coordinates`
4. Wire `GET /api/envmon/floors` for floor tab rendering (consumes `em_plant_floor`)

### Stop Conditions

- Do not implement heatmap before both Workstream A DDL and Workstream B em_* existence are confirmed.
- Do not claim heatmap parity if `em_location_coordinates` is empty in UAT — the render will show no markers.
- Do not invent a `riskScore` calculation — mark as not implemented or remove from heatmap contract until domain owner defines the algorithm.

---

## Workstream D — Governance / Admin

*Who maintains floorplans and zones, auditability, revision control, validation before activation*

### V1 Evidence

V1 implemented a complete governance model for spatial configuration:
- Full revision lifecycle with `change_reason` required on publish
- Pre-publish validation step producing `validation_summary_json`
- Supersede-on-publish ensuring only one active revision per floor
- Rollback capability restoring a previous published revision
- Identity stamps (`created_by`, `updated_by`, `published_by`) on all writes

The Spatial Studio was a dedicated admin surface, implying a role separation: environmental monitoring coordinators use the analysis views; a separate admin/studio role maintains the spatial configuration.

### V2 Current Status

No admin surface, no spatial write endpoints, no revision workflow implemented in V2. This workstream is entirely greenfield from a V2 code perspective.

### Required Data Objects

- All five em_* tables (writes required)
- Role/permission model for admin vs coordinator distinction
- Auth: write operations must use end-user OAuth identity for `created_by` / `updated_by` stamps

### Risk

| Risk | Severity | Mitigation |
|---|---|---|
| Admin role definition not yet designed in V2 | High | Do not implement write paths until the V2 permission model for spatial admin is defined |
| Revision workflow is multi-step transactional | High | Partial failures must be safe — define rollback semantics before implementing publish workflow |
| Validation rules in `validation_summary_json` are V1-internal | Medium | Document what V1 validates (orphan coordinates, geometry validity, missing locations) before implementing V2 validation |
| CAPA / corrective actions are entirely absent from V1 | Critical | V1 had no corrective action workflow. Implementing `getEnvMonCorrectiveActions` or any corrective action write path requires a fully new workflow design — not a migration task |

### Recommended Next Tranche

This workstream should not start until Workstreams B and C are complete and validated:

1. Define V2 permission model for spatial admin role
2. Implement read-only Studio surface (revision history, zone display)
3. Implement draft creation and zone CRUD (write paths)
4. Implement validate + publish workflow
5. Implement rollback

### Stop Conditions

- Do not implement any write path without OAuth identity confirmed for `created_by` stamps — service-principal writes violate the audit trail.
- Do not implement CAPA or corrective action workflows in this workstream — that is a separate product design problem.

---

## Recommended Sequencing

The sequencing below follows dependency order strictly. Steps that share a dependency chain are numbered together; steps that are blocked by earlier items cannot be safely skipped.

| Step | Action | Blocks |
|---|---|---|
| 1 | DESCRIBE TABLE for `gold_inspection_lot`, `gold_inspection_point`, `gold_batch_quality_result_v` in connected_plant_uat | Everything in Workstream A |
| 2 | SELECT DISTINCT INSPECTION_TYPE — confirm `'14'` and `'Z14'` present | Site summary route wiring |
| 3 | Wire `GET /api/envmon/site-summary` (QuerySpec already written) | Browser verification |
| 4 | Browser-verify site summary in UAT | Swab results route |
| 5 | Write QuerySpec for `getEnvMonSwabResults`; wire route | Trends route |
| 6 | SHOW TABLES IN connected_plant_uat.gold LIKE 'em_%' | All of Workstream B and C |
| 7 | Row-count em_plant_floor, em_location_coordinates | Heatmap parity claim |
| 8 | Wire floor plan list read adapter (`getEnvMonFloors`) | Heatmap |
| 9 | Wire coordinate/zone read adapter (`getEnvMonCoordinates`, `getEnvMonZones`) | Heatmap |
| 10 | Wire heatmap adapter (`getEnvMonHeatmap`) | Only after steps 1–9 complete |
| 11 | Design upload/image hosting solution with V1 deployment team | Background image edit in Workstream D |
| 12 | Design admin role / permission model | Workstream D write paths |
| 13 | Implement spatial write paths + revision/publish workflow | Full Studio parity |

**Steps 11–13 are intentionally deferred** and do not block steps 1–10.

---

## Key Risk Messages

### `openCorrectiveActions` / `overdueActions` defaulting to 0

Returning a hardcoded `0` for corrective action counts is **actively misleading** to users — it implies no corrective actions exist, when the real answer is "we have not implemented this". These fields must be either:
- Removed from the active contract until a CAPA source is implemented, or
- Clearly marked as `null` or `"not implemented"` in the API response

A zero that reads as "all clear" in a food safety dashboard is a patient safety risk.

### `trendDirection` defaulting to `'stable'`

A hardcoded `'stable'` is not a trend — it is a placeholder that will mislead coordinators. Either implement `trendDirection` from the `getEnvMonTrends` time-series (compute the slope over the period window) or make the field nullable and return `null` until implemented.

### `hygieneZone` / `areaType` have no V1 source

V1 `em_location_zones` has no hygiene zone classification field. Zones in V1 are generic L4 spatial boundary polygons with a `zone_name` string. If the V2 contract requires `hygieneZone` (e.g. Zone 1/2/3/4) or `areaType` (e.g. food contact / non-food contact), this is **new classification data** that must be designed and entered — it cannot be migrated from V1.

### Background image upload is an unresolved design gap

No V1 upload handler was found. The `background_image_url` column is a string reference to an externally hosted image. The hosting solution (cloud storage, CDN, Databricks Volume?) is not documented in the V1 repo. Do not design a V2 upload workflow until this is answered.

### CAPA / corrective actions are not in V1 at all

`getEnvMonCorrectiveActions` is not a migration task. There is no V1 corrective action table, no V1 CAPA workflow, and no confirmed data source. Implementing this method requires designing an entire new workflow: source system, write model, status lifecycle, assignee model, due date logic, and recurrence handling. This is a Phase 5+ product design problem.

### em_* tables may not exist in connected_plant_uat

This is the single highest-impact unknown. If `SHOW TABLES IN connected_plant_uat.gold LIKE 'em_%'` returns no rows, Workstreams B, C, and D are entirely blocked. The tables were created by the V1 EnvMon app deployment — they are not data engineering artefacts and may not have been provisioned in the V2 UAT environment. **Do not assume they exist.**

---

## Closing Note

Challenge this sequence if V1 evidence suggests otherwise.

V1 had a **fully working heatmap and Spatial Studio** — these features were in production use. The design risk is low; the architecture is understood; the data model is documented. The uncertainty is entirely in V2 infrastructure: do the em_* tables exist in `connected_plant_uat`? Are they populated with real coordinate data? Have the gold views been provisioned with the expected columns?

The recommended sequence is conservative because it sequences DDL confirmation before route wiring — not because the feature design is in doubt. If the em_* tables are confirmed to exist and are populated, Workstreams B and C can proceed quickly. The spatial studio authoring workflow (Workstream D) is the only workstream that requires significant new V2 design work.

The CAPA and corrective action gap is the honest hard stop. V1 never implemented corrective actions. Do not let a mock-data placeholder (`openCorrectiveActions: 0`) become a silent permanent default in a food safety application.
