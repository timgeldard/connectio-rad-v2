# EnvMon Native Databricks Groundwork Plan

**Date:** 2026-05-17 (i.txt groundwork) | **Corrected:** 2026-05-17 (k.txt SAP QM recovery)
**Status:** SAP QM SOURCE RECOVERED (confirmed-v1) — DDL verification pending
**Outcome:** V1 source model confirmed from SAP QM inspection lots. QuerySpec skeleton written for `getEnvMonSiteSummary`. Route deferred until DDL confirmed.

---

## Correction (k.txt, 2026-05-17)

The i.txt groundwork incorrectly concluded that EnvMon has "no source model" and should be treated as a LIMS-only app with zero gold views. This conclusion was wrong.

**Corrected status:**

> EnvMon V1 was fully functional and used SAP Quality inspection lot/result data filtered to `INSPECTION_TYPE IN ('14', 'Z14')`. The V1 source model has been recovered from the ConnectIO-RAD repo. Gold views are confirmed-v1 but DDL has not yet been run in connected_plant_uat.

The i.txt error occurred because the search used "LIMS" and "envmon" terminology instead of SAP QM terms (INSPECTION_TYPE, gold_inspection_lot, em_config). The V1 app is under `apps/envmon/` — but its data source is SAP QM inspection lots, not a standalone LIMS system.

---

## Current State (post k.txt, 2026-05-17)

| Item | Status |
|---|---|
| Adapter methods | 9 — all mock-only (no route wired) |
| FastAPI routes | None |
| Databricks QuerySpecs | **1** — `envmon.get_site_summary` (QuerySpec-only, no route) |
| Source system | **SAP QM inspection lots** (INSPECTION_TYPE IN ('14','Z14')) |
| Gold views confirmed-v1 | **3** — gold_inspection_lot, gold_inspection_point, gold_batch_quality_result_v |
| Gold views confirmed-ddl | **0** — DDL not yet run in connected_plant_uat |
| Object resolver | "envmon" domain key added → TRACE_CATALOG / TRACE_SCHEMA |
| Legacy-api adapter | None — native Databricks will be first live path |
| Source system (corrected) | SAP QM inspection lots via TRACE_CATALOG / TRACE_SCHEMA |

---

## What Was Audited (i.txt)

| Artefact | Finding |
|---|---|
| `domain-integrations/envmon/src/adapters/envmon-adapter.ts` | 9 mock-only methods; no Databricks imports; no QuerySpec |
| `packages/data-contracts/src/schemas/environmental-monitoring.ts` | 10 contract types defined; 3 key enums |
| `domain-integrations/envmon/src/panels/` | 8 panels; all `sourceOwnership: { systemName: 'lims' }` |
| `docs/product-model/envmon-monitoring.md` | lifecycle: live; 7 views; 8 panels |

---

## What Was Recovered (k.txt)

| Artefact | Finding |
|---|---|
| `ConnectIO-RAD/apps/envmon/backend/envmon_backend/utils/em_config.py` | **INSPECTION_TYPE IN ('14','Z14')** — definitive filter; all three gold view names |
| `ConnectIO-RAD/apps/envmon/backend/envmon_backend/inspection_analysis/dal/plants.py` | Full KPI SQL with join keys; basis for `getEnvMonSiteSummary` QuerySpec |
| `ConnectIO-RAD/apps/envmon/backend/envmon_backend/inspection_analysis/dal/heatmap.py` | Floor plan + result join SQL; app-managed table dependency identified |
| `ConnectIO-RAD/apps/envmon/backend/envmon_backend/inspection_analysis/dal/trends.py` | MIC time-series SQL |
| `ConnectIO-RAD/apps/envmon/backend/envmon_backend/inspection_analysis/dal/lots.py` | Per-location lot listing + per-lot MIC detail |
| `ConnectIO-RAD/ai-context/semantic-model/entities.yaml` | Column-level DDL for gold_inspection_lot, gold_inspection_point, gold_batch_quality_result_v, em_* tables |

---

## Key Findings (corrected)

**Finding 1 — Source system is SAP QM, not LIMS.**
EnvMon data originates from SAP QM inspection lots (recurring environmental inspection types 14/Z14). The data is in `TRACE_CATALOG.TRACE_SCHEMA` — the same catalog as Trace2. The LIMS badge in V1 panels (`systemName: 'lims'`) reflects the functional domain, not the data source technology.

**Finding 2 — Three gold views confirmed from V1 source.**
`gold_inspection_lot`, `gold_inspection_point`, and `gold_batch_quality_result_v` are confirmed-v1 from `em_config.py`, `entities.yaml`, and DAL SQL. DDL not yet run in connected_plant_uat.

**Finding 3 — First safe slice identified: `getEnvMonSiteSummary`.**
V1 `fetch_plant_kpis` (plants.py) uses only the three gold views — no app-managed em_* tables. This is the lowest-risk first slice. QuerySpec written in `apps/api/adapters/envmon/envmon_databricks_adapter.py`.

**Finding 4 — Heatmap and zone-level methods blocked by app-managed tables.**
The em_* tables (`em_location_coordinates`, `em_plant_floor`, etc.) are app-managed and may not exist in `connected_plant_uat`. Do not implement heatmap until existence confirmed via `SHOW TABLES`.

**Finding 5 — Panel source badge concern remains.**
All 8 panels register `systemName: 'lims'`. When a native Databricks slice is wired, update `systemName` in each affected panel registration at the same time. Do not update the badge before wiring the route.

---

## Groundwork Documents

| Document | Purpose | k.txt status |
|---|---|---|
| `docs/migration/envmon-v1-functional-recovery.md` | V1 source recovery report | **New — k.txt** |
| `docs/audit/envmon-sap-qm-source-model.md` | SAP QM view/column documentation | **New — k.txt** |
| `docs/audit/envmon-inspection-lot-type-filter.md` | INSPECTION_TYPE IN ('14','Z14') filter | **New — k.txt** |
| `docs/domains/envmon-monitoring.md` | Adapter/contract/source reference | Updated — k.txt |
| `docs/audit/envmon-contract-inventory.md` | Per-method fields + SAP QM mapping | Updated — k.txt |
| `docs/audit/envmon-databricks-source-candidates.md` | Source candidates (confirmed-v1) | Updated — k.txt |
| `docs/audit/envmon-native-column-verification-checklist.md` | DDL checks — SAP QM views | Updated — k.txt |
| `docs/migration/envmon-native-candidate-ranking.md` | Ranked candidates with V1 evidence | Updated — k.txt |
| `docs/audit/envmon-native-architecture-check.md` | Architecture guardrail check | Updated — k.txt |

---

## What Is Needed to Un-defer the Route

In order:

1. **Run `DESCRIBE TABLE`** for all three gold views in connected_plant_uat SQL Editor
2. **Run `SELECT DISTINCT INSPECTION_TYPE`** — confirm '14' and 'Z14' are present
3. **Run `SELECT DISTINCT INSPECTION_RESULT_VALUATION`** — confirm valuation values
4. **Update `docs/audit/envmon-native-column-verification-checklist.md`** — mark columns `confirmed-ddl`
5. **Wire `GET /api/envmon/site-summary` route** in `apps/api/routes/envmon.py` (file does not yet exist)
6. **Browser-verify** in UAT before claiming BV status

Do not wire the route before step 4. The QuerySpec SQL is confirmed-v1 only.
