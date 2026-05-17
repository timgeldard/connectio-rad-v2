# Environmental Monitoring — Adapter and Contract Reference

**Date:** 2026-05-17 (i.txt) | **Corrected:** 2026-05-17 (k.txt)
**Adapter:** `domain-integrations/envmon/src/adapters/envmon-adapter.ts`
**Data contracts:** `packages/data-contracts/src/schemas/environmental-monitoring.ts`
**Product model:** `docs/product-model/envmon-monitoring.md` (workspace views, panels, metadata)
**Migration plan:** `docs/migration/envmon-native-groundwork-plan.md`

This document covers the adapter interface, data contract structure, source system status, and migration blockers. For workspace views, panel layout, and product-level detail see the product model above.

---

## Source System (corrected, k.txt 2026-05-17)

**Source:** SAP QM inspection lots (not LIMS)

EnvMon V1 reads from the same Databricks gold layer as Trace2 — `TRACE_CATALOG / TRACE_SCHEMA` (default `connected_plant_uat.gold`). The data is SAP Quality Management inspection lots filtered to `INSPECTION_TYPE IN ('14', 'Z14')` (recurring environmental inspection).

The `systemName: 'lims'` badge in V1 panels reflects the functional domain context, not the data integration technology. The actual source is SAP QM.

| Item | Value |
|---|---|
| Source system | SAP QM inspection lots |
| Catalog env var | `TRACE_CATALOG` |
| Schema env var | `TRACE_SCHEMA` (default: `gold`) |
| Inspection type filter | `INSPECTION_TYPE IN ('14', 'Z14')` |
| Gold views confirmed-v1 | `gold_inspection_lot`, `gold_inspection_point`, `gold_batch_quality_result_v` |
| Gold views confirmed-ddl | **Zero** — DDL not yet run in connected_plant_uat |
| QuerySpecs written | **1** — `envmon.get_site_summary` (QuerySpec-only, no route wired) |
| FastAPI routes | **None** — deferred until DDL confirmed |
| Legacy-api adapter | None — native Databricks will be first live data path |

---

## Adapter Interface

**Class:** `EnvMonAdapter`
**Request interface:** `{ readonly regionId?: string; readonly plantId?: string; readonly periodStart?: string; readonly periodEnd?: string }`

All request fields are optional. The mock adapter ignores them. Future native slices will use `plantId` and `periodStart`/`periodEnd` for WHERE clause filtering; `regionId` maps to a site grouping concept.

---

## Adapter Methods

| Method | Return type | Status |
|---|---|---|
| `getEnvMonContext` | `EnvMonContext` | Mock |
| `getEnvMonSiteSummary` | `EnvMonSiteSummary` | Mock — **QuerySpec written** (DDL pending; route not wired) |
| `getEnvMonZones` | `EnvMonZone[]` | Mock — blocked on em_location_zones |
| `getEnvMonAlerts` | `EnvMonAlert[]` | Mock — alert derivation logic undefined |
| `getEnvMonSwabResults` | `EnvMonSwabResult[]` | Mock — after DDL verification |
| `getEnvMonTrends` | `EnvMonTrend[]` | Mock — after DDL verification |
| `getEnvMonHeatmap` | `EnvMonHeatmapCell[]` | Mock — blocked on em_* app-managed tables |
| `getEnvMonCorrectiveActions` | `EnvMonCorrectiveAction[]` | Mock — no CAPA source |
| `getEnvMonSwabVectors` | `EnvMonSwabVector[]` | Mock — business rules undefined; deferred indefinitely |

---

## Key Contract Enums

Defined in `packages/data-contracts/src/schemas/environmental-monitoring.ts`. Must be confirmed against actual source view data with `SELECT DISTINCT` before column mapping.

| Field | Allowed values (V2 contract) | SAP QM equivalent (confirmed-v1) |
|---|---|---|
| `result` | `negative`, `positive`, `borderline`, `pending` | VALUATION: A→negative, R/REJ/REJECT→positive, W/WARN→borderline, NULL→pending |
| `hygieneZone` | `zone-1`, `zone-2`, `zone-3`, `zone-4` | Derived from em_location_zones (app-managed — existence unknown in UAT) |
| `areaType` | `production`, `storage`, `packaging`, `utility`, `corridor`, `other` | Derived from em_location_zones (same) |

---

## Panel Source Badge

All 8 EnvMon panels register:

```typescript
sourceOwnership: {
  domainId: 'envmon',
  systemName: 'lims',
  legacyAppId: 'lims',
}
```

This is **static metadata** — not a runtime field from the API response. The EvidencePanel component renders `systemName` as the visible source badge. When a native Databricks route is wired, update `systemName` to reflect the actual source (`'sap-qm'` or `'databricks'`) in each affected panel's registration. Do this at the same time as wiring the route — not before.

---

## Migration Blockers

1. **DDL not run** — run `DESCRIBE TABLE` for all three gold views in connected_plant_uat before wiring any route
2. **Inspection type filter not DDL-confirmed** — run `SELECT DISTINCT INSPECTION_TYPE` to confirm '14' and 'Z14' are present
3. **em_* tables unknown** — zone, heatmap, and coordinates methods require app-managed tables that may not exist in connected_plant_uat
4. **No route path established** — POH uses `/api/por/`, CQ uses `/api/cq/`, EnvMon will use `/api/envmon/` (not yet created)

For the full groundwork plan and recovery detail see `docs/migration/envmon-native-groundwork-plan.md` and `docs/migration/envmon-v1-functional-recovery.md`.
For SAP QM source view documentation see `docs/audit/envmon-sap-qm-source-model.md`.
For DDL verification see `docs/audit/envmon-native-column-verification-checklist.md`.
