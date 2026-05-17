# EnvMon Native Databricks — Candidate Slice Ranking

**Date:** 2026-05-17 (i.txt) | **Corrected:** 2026-05-17 (k.txt SAP QM recovery)
**Status:** SITE SUMMARY first (QuerySpec written) — all others deferred until DDL confirmed
**Reference:** `docs/audit/envmon-sap-qm-source-model.md`, `docs/migration/envmon-v1-functional-recovery.md`

---

## Correction (k.txt)

The i.txt ranking had all candidates BLOCKED on "no source view". The V1 source model has been recovered. Candidates are now ranked using confirmed-v1 evidence. Source confidence is now the primary discriminator between implementable and deferred slices.

---

## Ranking Criteria

| Criterion | Weight | Notes |
|---|---|---|
| Source confidence | Critical | confirmed-v1 > assumed; confirmed-ddl required before route wiring |
| em_* table dependency | Critical | App-managed tables may not exist in connected_plant_uat — blocks any method that needs them |
| Mapping complexity | Medium | Simple columns-to-fields vs aggregation vs business rules |
| V1 support | High | Does V1 implement this feature? If so, SQL and semantics are known |
| Browser-verifiable | Medium | Can a developer verify in UAT browser? |
| Business rules confirmed | High | Alerts, vectors, corrective actions need rule definitions |

---

## Rank 1 — Site Summary (QuerySpec written; recommended first route)

**Adapter method:** `getEnvMonSiteSummary`
**Returns:** `EnvMonSiteSummary` — aggregated KPI counts for a plant/period
**QuerySpec:** `apps/api/adapters/envmon/envmon_databricks_adapter.py` → `get_site_summary_spec`

**Why first:**
- V1 `plants.py` `fetch_plant_kpis` SQL confirmed — join keys, column names, filter values all known
- Uses ONLY `gold_inspection_lot + gold_inspection_point + gold_batch_quality_result_v` — no em_* joins
- Returns 1 aggregated row per plant — minimal data transfer risk
- Inspection type filter `IN ('14','Z14')` confirmed-v1

**Partial coverage:**
- `totalSamples` ← `lots_tested` (lot-level count; not swab-level)
- `positiveSamples` ← `active_fails` (location-level fail count)
- `positiveRate` ← computed
- `criticalZoneExposures`, `openCorrectiveActions`, `trendDirection` ← defaults (em_* / CAPA source not confirmed)

**Status:** QuerySpec written (confirmed-v1) — **DDL required before route wiring**

| Item | Status |
|---|---|
| Source views | confirmed-v1 |
| V1 SQL recovered | Yes (plants.py `fetch_plant_kpis`) |
| em_* dependency | None |
| DDL run | No |
| Route wired | No — deferred until DDL confirmed |
| Browser-verified | No |

---

## Rank 2 — Swab Results (individual results per sample point)

**Adapter method:** `getEnvMonSwabResults`
**Returns:** `EnvMonSwabResult[]` — one row per MIC test per sample point

**Why second:**
- Same three gold views as site summary — no new dependencies
- V1 `lots.py` DAL provides the per-MIC result SQL pattern
- Enriches `positiveSamples` count with individual result rows and organism details

**Partial coverage:**
- `sampleId` ← `SAMPLE_ID` (confirmed-v1)
- `testType` ← `MIC_NAME` (confirmed-v1)
- `result` ← derived from `INSPECTION_RESULT_VALUATION` (confirmed-v1 valuation mapping)
- `resultValue` ← `QUANTITATIVE_RESULT` (confirmed-v1)
- `specification` ← `UPPER_TOLERANCE` (confirmed-v1)
- `locationId` ← `FUNCTIONAL_LOCATION` (confirmed-v1) — maps to V2 contract as location identifier
- `zoneId` ← **not available** without em_location_zones
- `hygieneZone` ← **not available** without em_location_zones
- `sampledBy`, `analysedBy` ← **not available** from gold views (V1 did not expose these)

**Status:** QuerySpec not yet written — deferred until DDL confirmed for site summary

---

## Rank 3 — Trends (time-series by period)

**Adapter method:** `getEnvMonTrends`
**Returns:** `EnvMonTrend[]` — period-bucketed positive rates

**Why third:**
- Same three gold views — no new dependencies
- V1 `trends.py` provides the time-series SQL with date truncation

**Status:** Deferred — implement after site summary DDL confirmed

---

## Rank 4 — Zones / Locations (reference data)

**Adapter method:** `getEnvMonZones`
**Returns:** `EnvMonZone[]` — zone master with hygiene zone classification

**Why fourth (despite being a simple reference-table pattern):**
- Requires `em_location_zones` or equivalent for `hygieneZone` and `areaType` classification
- `em_location_zones` is an app-managed table — **may not exist in connected_plant_uat**
- Without it, only `FUNCTIONAL_LOCATION` strings are available — no zone mapping

**Status:** **Blocked** — pending confirmation that em_location_zones exists in connected_plant_uat

---

## Rank 5 — Alerts (derived from result data)

**Adapter method:** `getEnvMonAlerts`
**Returns:** `EnvMonAlert[]` — positive/warning findings as alerts

**Why fifth:**
- Can be derived from swab results where `INSPECTION_RESULT_VALUATION IN ('R','REJ','REJECT','W','WARN')`
- Alert derivation logic (severity classification, alertType) undefined — needs domain owner input
- The `severity` enum (`low`/`medium`/`high`/`critical`) has no direct SAP QM equivalent

**Status:** Deferred — implement after swab results confirmed; alert rules need definition

---

## Rank 6 — Corrective Actions

**Adapter method:** `getEnvMonCorrectiveActions`
**Returns:** `EnvMonCorrectiveAction[]` — CAPA records

**Why sixth:**
- No CAPA/corrective action source identified in the gold layer
- V1 app may have managed CAPAs in a separate app-managed table

**Status:** **Blocked** — no source identified

---

## Rank 7 — Heatmap

**Adapter method:** `getEnvMonHeatmap`
**Returns:** `EnvMonHeatmapCell[]` — grid cells with risk scores

**Why seventh:**
- Requires `em_location_coordinates` (x/y positions) + `em_plant_floor` (SVG dimensions)
- Both are app-managed tables — **may not exist in connected_plant_uat**
- V1 confirmed these tables exist, but they may not be in the UAT Databricks catalog

**Status:** **Blocked** — pending `SHOW TABLES IN connected_plant_uat.gold LIKE 'em_%'`

---

## Rank 8 — Swab Vectors (deferred indefinitely)

**Adapter method:** `getEnvMonSwabVectors`
**Returns:** `EnvMonSwabVector[]` — contamination trajectory / spread signals

**Why last:**
- Requires proximity/adjacency rules between sampling points — not a simple table query
- Temporal correlation rules are undefined
- Depends on zones (Rank 4) and swab results (Rank 2) being implemented first

**Status:** **Deferred indefinitely** — business rules undefined; depends on earlier ranks

---

## Recommended Implementation Sequence

1. Run DDL for all three primary views in Databricks SQL Editor
2. Update `docs/audit/envmon-native-column-verification-checklist.md` with `confirmed-ddl` status
3. Wire `GET /api/envmon/site-summary` route — Rank 1 (QuerySpec already exists)
4. Browser-verify in UAT
5. Implement Rank 2 QuerySpec (`envmon.get_swab_results`)
6. Wire `GET /api/envmon/swab-results` route after DDL confirmed
7. Implement Rank 3 (trends) — shares same views
8. Proceed to Rank 4+ only when em_* table existence is confirmed

---

## Current Status Summary

| Rank | Slice | Method | Source confidence | em_* dependency | Status |
|---|---|---|---|---|---|
| 1 | Site Summary | `getEnvMonSiteSummary` | confirmed-v1 | None | **QuerySpec written — DDL pending** |
| 2 | Swab Results | `getEnvMonSwabResults` | confirmed-v1 | None | Deferred until Rank 1 DDL confirmed |
| 3 | Trends | `getEnvMonTrends` | confirmed-v1 | None | Deferred until Rank 1 DDL confirmed |
| 4 | Zones | `getEnvMonZones` | assumed | em_location_zones | Blocked — em_* unknown |
| 5 | Alerts | `getEnvMonAlerts` | partial (derivable) | None | Deferred — alert rules undefined |
| 6 | Corrective Actions | `getEnvMonCorrectiveActions` | none | unknown | Blocked — no CAPA source |
| 7 | Heatmap | `getEnvMonHeatmap` | confirmed-v1 for views; app tables unknown | em_location_coordinates, em_plant_floor | Blocked — em_* unknown |
| 8 | Swab Vectors | `getEnvMonSwabVectors` | none | partial | Deferred indefinitely — business rules undefined |
