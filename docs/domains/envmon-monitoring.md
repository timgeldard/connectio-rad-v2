# Environmental Monitoring — Adapter and Contract Reference

**Date:** 2026-05-17
**Adapter:** `domain-integrations/envmon/src/adapters/envmon-adapter.ts`
**Data contracts:** `packages/data-contracts/src/schemas/environmental-monitoring.ts`
**Product model:** `docs/product-model/envmon-monitoring.md` (workspace views, panels, metadata)
**Migration plan:** `docs/migration/envmon-native-groundwork-plan.md`

This document covers the adapter interface, data contract structure, source system status, and migration blockers. For workspace views, panel layout, and product-level detail see the product model above.

---

## Adapter Interface

**Class:** `EnvMonAdapter`
**Request interface:** `{ readonly regionId?: string; readonly plantId?: string; readonly periodStart?: string; readonly periodEnd?: string }`

All request fields are optional. The mock adapter ignores them. Future native slices will use `plantId` and `periodStart`/`periodEnd` for WHERE clause filtering; `regionId` maps to a site grouping concept whose Databricks equivalent is not yet known.

---

## Adapter Methods

| Method | Return type | Status |
|---|---|---|
| `getEnvMonContext` | `EnvMonContext` | Mock |
| `getEnvMonSiteSummary` | `EnvMonSiteSummary` | Mock |
| `getEnvMonZones` | `EnvMonZone[]` | Mock |
| `getEnvMonAlerts` | `EnvMonAlert[]` | Mock |
| `getEnvMonSwabResults` | `EnvMonSwabResult[]` | Mock |
| `getEnvMonTrends` | `EnvMonTrend[]` | Mock |
| `getEnvMonHeatmap` | `EnvMonHeatmapCell[]` | Mock |
| `getEnvMonCorrectiveActions` | `EnvMonCorrectiveAction[]` | Mock |
| `getEnvMonSwabVectors` | `EnvMonSwabVector[]` | Mock |

No FastAPI routes exist for EnvMon. No Databricks QuerySpecs exist. No legacy-api adapter exists.

---

## Source System

**Intended source:** LIMS (Laboratory Information Management System)
**Current source:** Mock data — Phase 4; LIMS data either not yet surfaced in the Databricks gold layer, or gold views not yet identified in this repo
**Databricks gold views confirmed:** Zero
**Legacy-api adapter:** None — no V1 proxy path

When native Databricks is implemented, it will be the first live data path for this domain. There is no legacy-api path to validate against in parallel.

---

## Key Contract Enums

Defined in `packages/data-contracts/src/schemas/environmental-monitoring.ts`. These must be confirmed against actual source view data with `SELECT DISTINCT` before column mapping — do not assume the values match without DDL verification.

| Field | Allowed values |
|---|---|
| `areaType` | `production`, `storage`, `packaging`, `utility`, `corridor`, `other` |
| `hygieneZone` | `zone-1`, `zone-2`, `zone-3`, `zone-4` |
| `result` | `negative`, `positive`, `borderline`, `pending` |

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

This is **static metadata** in the panel registration object — not a runtime field from the API response. However, the EvidencePanel component renders `systemName` as the visible source badge in the UI. All users currently see **"lims"** as the source for all EnvMon panels, including while data is mock.

When a native Databricks slice is implemented, update `systemName` (and `legacyAppId`) in each affected panel's registration to reflect the actual data source. Do this at the same time as wiring the native route — not before.

---

## Migration Blockers

1. No Databricks gold views identified — domain owner must name the LIMS source views
2. No legacy-api adapter — native Databricks will be the first live data path; no parallel validation possible
3. Contract enum values (`hygieneZone`, `areaType`, `result`) must be confirmed against actual view data before mapping
4. No FastAPI route path convention established for EnvMon (POH uses `/api/por/`, CQ uses `/api/cq/`, EnvMon has no precedent yet)

For the full groundwork plan and unblocking steps see `docs/migration/envmon-native-groundwork-plan.md`.
For candidate source objects and DDL verification see `docs/audit/envmon-databricks-source-candidates.md` and `docs/audit/envmon-native-column-verification-checklist.md`.
