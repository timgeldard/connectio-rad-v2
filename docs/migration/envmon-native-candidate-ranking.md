# EnvMon Native Databricks — Candidate Slice Ranking

**Date:** 2026-05-17
**Tranche:** i.txt groundwork
**Status:** ALL CANDIDATES BLOCKED — no source views identified; ranking is hypothetical only
**Reference:** `docs/audit/envmon-databricks-source-candidates.md`, `docs/audit/envmon-contract-inventory.md`

---

## Ranking Criteria

| Criterion | Weight | Notes |
|---|---|---|
| User value | High | Does this slice show data users care about most? |
| Source confidence | Critical | Is the source view confirmed in Unity Catalog? |
| Mapping complexity | Medium | Simple columns-to-fields vs aggregation vs business rules |
| Semantic risk | Medium | Enum mismatch, null handling, derived fields |
| UI readiness | Low | Does the frontend panel exist and accept real data without changes? |
| Browser-verifiable | Medium | Can a developer verify the result in the UAT browser? |
| Dependencies | High | Does this slice depend on other unconfirmed objects? |

**Source confidence is the overriding criterion.** A high-value, low-complexity slice cannot be implemented if the source view is unconfirmed. All candidates below are currently BLOCKED on this criterion.

---

## Candidate Slices — Ranked by Hypothetical Value

### Rank 1 — Swab Results (most valuable if source confirmed)

**Adapter method:** `getEnvMonSwabResults`
**Returns:** `EnvMonSwabResult[]` — individual sampling results per location

**Why first:** Individual swab results are the atomic unit of environmental monitoring. All other panels (summaries, trends, heatmap, alerts) are aggregations or derivatives of swab results. If only one view exists in the gold layer, it is most likely the results table.

**Mapping:** Relatively straightforward — one row per sample per test type. Required fields: sample ID, location ID, sample date, test type, result enum, result value, unit, plant.

**Semantic risk:** Medium. The `result` enum (`negative`, `positive`, `borderline`, `pending`) must exactly match the source view values. `SELECT DISTINCT RESULT` verification is required before mapping.

**Status: BLOCKED** — no source view identified.

---

### Rank 2 — Monitoring Locations / Sampling Points

**Adapter method:** `getEnvMonZones` (partially) or a new `getEnvMonLocations` if the contract is refactored
**Returns:** `EnvMonZone[]` — zones with hygiene zone classification and area type

**Why second:** A location/zone master is often a small, stable reference table — lowest row count, highest chance of a clean simple schema. It enables `plantId` filtering for all other slices. If a sampling-point view exists, this would be the easiest to verify.

**Mapping:** Simple reference-table pattern — one row per zone/location. Required fields: zone ID, zone name, hygiene zone enum, area type enum, plant ID.

**Semantic risk:** Medium. The `hygieneZone` enum (`zone-1` .. `zone-4`) and `areaType` enum must match the source. Run `SELECT DISTINCT HYGIENE_ZONE` before mapping.

**Status: BLOCKED** — no source view identified.

---

### Rank 3 — Site Summary (aggregation)

**Adapter method:** `getEnvMonSiteSummary`
**Returns:** `EnvMonSiteSummary` — aggregated counts and rates for a plant/period

**Why third:** Useful as a KPI card, but requires aggregation over the results view (or a pre-aggregated summary view). If the source is a raw results table, this becomes a multi-step aggregation query rather than a simple SELECT.

**Mapping:** Either SELECT with COUNT/SUM aggregation, or a pre-built summary view. Pre-built view would be simpler and more performant.

**Semantic risk:** Low for count/rate fields. The `trendDirection` field (period-over-period comparison) is more complex — may require two period queries or a pre-built trend column.

**Status: BLOCKED** — no source view identified.

---

### Rank 4 — Alerts

**Adapter method:** `getEnvMonAlerts`
**Returns:** `EnvMonAlert[]` — active alerts (positive results, out-of-limit events)

**Why fourth:** Alerts are derived events, not raw data. They may be: (a) rows in a dedicated alerts/CAPA table in LIMS, or (b) derived from swab results where `result = 'positive'` or value exceeds specification. Path (b) can be implemented without a separate alerts view. Path (a) requires a separate confirmed source.

**Semantic risk:** High if alerts are CAPA records with business-rule-based severity classification. The `severity` enum and `alertType` classification need domain owner input.

**Status: BLOCKED** — no source view identified; alert derivation logic undefined.

---

### Rank 5 — Trends

**Adapter method:** `getEnvMonTrends`
**Returns:** `EnvMonTrend[]` — period-bucketed positive rates

**Why fifth:** Requires date-bucketed aggregation over a time series of results. Simple if results have a reliable `SAMPLE_DATE` column. But the period bucket (weekly, monthly) must be defined and the UI must accept the period granularity produced.

**Status: BLOCKED** — no source view; time bucketing logic undefined.

---

### Rank 6 — Corrective Actions

**Adapter method:** `getEnvMonCorrectiveActions`
**Returns:** `EnvMonCorrectiveAction[]` — CAPA records

**Why sixth:** CAPA records may exist in LIMS or in a separate quality management system. Their availability in Databricks is unknown and their schema is highly system-specific.

**Semantic risk:** High. Business rules for status transitions, due date logic, and assignment are undefined.

**Status: BLOCKED** — no source view identified; business rules undefined.

---

### Rank 7 — Heatmap

**Adapter method:** `getEnvMonHeatmap`
**Returns:** `EnvMonHeatmapCell[]` — grid cells with risk scores

**Why seventh:** Requires floor-plan or grid coordinates per sampling point. This is likely not in the gold views alongside result data — it may require a separate static reference table with x/y coordinates per location. Two-source join risk.

**Status: BLOCKED** — no source view; floor plan / coordinate source unknown.

---

### Rank 8 — Swab Vectors (deferred indefinitely)

**Adapter method:** `getEnvMonSwabVectors`
**Returns:** `EnvMonSwabVector[]` — contamination trajectory / spread signals

**Why last:** Swab vectors require business-rule-defined contamination chain logic — identifying correlations between repeated positive events at adjacent locations. This is an analytical computation, not a simple table read. It requires: (a) confirmed swab result data, (b) proximity/adjacency rules between sampling points, (c) temporal correlation rules. None of these are defined.

**Status: BLOCKED** — no source; business rules undefined; depends on ranks 1 and 2 being solved first.

---

## Recommended Implementation Sequence (when source is confirmed)

1. Confirm source view for raw swab results (Rank 1)
2. Implement `envmon.get_swab_results` QuerySpec — no route yet
3. Confirm sampling point / zone master view (Rank 2)
4. Implement `envmon.get_zones` QuerySpec — no route yet
5. Wire `GET /api/envmon/swab-results` route (results slice only)
6. Wire `GET /api/envmon/zones` route (reference data)
7. Browser-verify both routes in UAT
8. Derive site summary from results data (Rank 3)
9. Proceed to alerts and trends only after results are stable

Do not implement Rank 6 (corrective actions), Rank 7 (heatmap), or Rank 8 (vectors) without additional domain owner input on business rules and additional source views.

---

## Current Status Summary

| Rank | Slice | Method | Status |
|---|---|---|---|
| 1 | Swab Results | `getEnvMonSwabResults` | BLOCKED — no source view |
| 2 | Zones / Locations | `getEnvMonZones` | BLOCKED — no source view |
| 3 | Site Summary | `getEnvMonSiteSummary` | BLOCKED — no source view |
| 4 | Alerts | `getEnvMonAlerts` | BLOCKED — no source view + logic undefined |
| 5 | Trends | `getEnvMonTrends` | BLOCKED — no source view |
| 6 | Corrective Actions | `getEnvMonCorrectiveActions` | BLOCKED — no source view |
| 7 | Heatmap | `getEnvMonHeatmap` | BLOCKED — no source view + coordinates unknown |
| 8 | Swab Vectors | `getEnvMonSwabVectors` | BLOCKED — no source view + rules undefined; deferred indefinitely |
