# EnvMon Contract Inventory

**Date:** 2026-05-17
**Tranche:** i.txt groundwork
**Adapter:** `domain-integrations/envmon/src/adapters/envmon-adapter.ts`
**Contracts:** `packages/data-contracts/src/schemas/environmental-monitoring.ts`
**Status:** All methods mock-only. No source columns confirmed. Fields are documented from the Zod schema — not from live Databricks data.

---

## Legend

| Column | Meaning |
|---|---|
| Filters used | Request fields the method would pass to a WHERE clause (future native path) |
| Source badge | `systemName` registered in the panel's `sourceOwnership` |
| Contract status | `confirmed` = field is in the Zod schema; `assumed` = field name inferred; `missing` = not in schema |

---

## 1. `getEnvMonContext`

**Return type:** `EnvMonContext`
**Panel:** EnvMon context panel (workspace-level context)
**Filters used:** `plantId`, `regionId`
**Source badge:** `lims` (static — all EnvMon panels)

| Contract field | Likely source concept | Status |
|---|---|---|
| `plantId` | Plant/site identifier | Confirmed in schema |
| `regionId` | Site group / region | Confirmed in schema |
| `periodStart` | Date range start | Confirmed in schema |
| `periodEnd` | Date range end | Confirmed in schema |
| `kpiSummary` | Aggregated KPI object | Confirmed in schema — see `EnvMonKpiSummary` |

---

## 2. `getEnvMonSiteSummary`

**Return type:** `EnvMonSiteSummary`
**Panel:** Site summary panel
**Filters used:** `plantId`, `regionId`, `periodStart`, `periodEnd`
**Source badge:** `lims`

| Contract field | Likely source concept | Status |
|---|---|---|
| `totalSamples` | Count of sampling events in period | Confirmed in schema |
| `positiveSamples` | Count of positive/failed results | Confirmed in schema |
| `positiveRate` | `positiveSamples / totalSamples` | Confirmed in schema |
| `criticalZoneExposures` | Positives in Zone 1 | Confirmed in schema |
| `openCorrectiveActions` | Unresolved CAPAs | Confirmed in schema |
| `trendDirection` | Period-over-period comparison | Confirmed in schema |

---

## 3. `getEnvMonZones`

**Return type:** `EnvMonZone[]`
**Panel:** Zones panel
**Filters used:** `plantId`
**Source badge:** `lims`

| Contract field | Likely source concept | Status |
|---|---|---|
| `zoneId` | Zone identifier | Confirmed in schema |
| `zoneName` | Zone display name | Confirmed in schema |
| `hygieneZone` | `zone-1` / `zone-2` / `zone-3` / `zone-4` | Confirmed in schema — enum must be verified against view |
| `areaType` | `production` / `storage` / `packaging` / `utility` / `corridor` / `other` | Confirmed in schema — enum must be verified |
| `plantId` | Plant identifier | Confirmed in schema |
| `activeSwabPoints` | Count of active sampling points in zone | Confirmed in schema |
| `lastSampleDate` | Most recent sample date | Confirmed in schema |
| `riskLevel` | `low` / `medium` / `high` | Confirmed in schema |

---

## 4. `getEnvMonAlerts`

**Return type:** `EnvMonAlert[]`
**Panel:** Alerts panel
**Filters used:** `plantId`, `periodStart`, `periodEnd`
**Source badge:** `lims`

| Contract field | Likely source concept | Status |
|---|---|---|
| `alertId` | Alert / finding identifier | Confirmed in schema |
| `alertType` | Alert category | Confirmed in schema |
| `severity` | `low` / `medium` / `high` / `critical` | Confirmed in schema |
| `zoneId` | Zone where alert originated | Confirmed in schema |
| `locationId` | Specific sampling point | Confirmed in schema |
| `description` | Alert description text | Confirmed in schema |
| `raisedAt` | Alert timestamp | Confirmed in schema |
| `status` | `open` / `acknowledged` / `resolved` | Confirmed in schema |

---

## 5. `getEnvMonSwabResults`

**Return type:** `EnvMonSwabResult[]`
**Panel:** Swab results panel
**Filters used:** `plantId`, `periodStart`, `periodEnd`
**Source badge:** `lims`

This is the most data-intensive method — individual test results per sampling point. Likely the most important for native Databricks migration.

| Contract field | Likely source concept | Status |
|---|---|---|
| `sampleId` | LIMS sample / swab identifier | Confirmed in schema |
| `locationId` | Sampling point identifier | Confirmed in schema |
| `locationName` | Sampling point display name | Confirmed in schema |
| `zoneId` | Zone containing this point | Confirmed in schema |
| `hygieneZone` | `zone-1` .. `zone-4` | Confirmed in schema — enum |
| `sampleDate` | Date/time sample was taken | Confirmed in schema |
| `testType` | Organism or test type (e.g. Listeria, TVC) | Confirmed in schema |
| `result` | `negative` / `positive` / `borderline` / `pending` | Confirmed in schema — enum |
| `resultValue` | Numeric result (CFU, count) | Confirmed in schema |
| `unit` | Unit of measure for numeric result | Confirmed in schema |
| `specification` | Pass/fail limit | Confirmed in schema |
| `sampledBy` | Person who took the sample | Confirmed in schema |
| `analysedBy` | Person/lab who analysed | Confirmed in schema |
| `plantId` | Plant where sample was taken | Confirmed in schema |

---

## 6. `getEnvMonTrends`

**Return type:** `EnvMonTrend[]`
**Panel:** Trends panel
**Filters used:** `plantId`, `periodStart`, `periodEnd`
**Source badge:** `lims`

| Contract field | Likely source concept | Status |
|---|---|---|
| `periodLabel` | Time bucket label (week, month) | Confirmed in schema |
| `totalSamples` | Samples in this period bucket | Confirmed in schema |
| `positiveSamples` | Positives in this period bucket | Confirmed in schema |
| `positiveRate` | Rate for this bucket | Confirmed in schema |
| `zoneId` | Optional zone filter | Confirmed in schema |
| `testType` | Optional test type filter | Confirmed in schema |

---

## 7. `getEnvMonHeatmap`

**Return type:** `EnvMonHeatmapCell[]`
**Panel:** Heatmap panel
**Filters used:** `plantId`, `periodStart`, `periodEnd`
**Source badge:** `lims`

Heatmap visualises risk density by zone/area. Requires location coordinates or a zone-grid definition — this is a potential blocker if no floor plan or coordinate source exists in the gold layer.

| Contract field | Likely source concept | Status |
|---|---|---|
| `cellId` | Grid cell identifier | Confirmed in schema |
| `zoneId` | Zone the cell belongs to | Confirmed in schema |
| `riskScore` | Numeric risk density | Confirmed in schema |
| `sampleCount` | Samples in this cell | Confirmed in schema |
| `positiveCount` | Positives in this cell | Confirmed in schema |
| `x` | Grid x-coordinate | Confirmed in schema — may require floor plan source |
| `y` | Grid y-coordinate | Confirmed in schema — may require floor plan source |

---

## 8. `getEnvMonCorrectiveActions`

**Return type:** `EnvMonCorrectiveAction[]`
**Panel:** Corrective actions panel
**Filters used:** `plantId`, `periodStart`, `periodEnd`
**Source badge:** `lims`

| Contract field | Likely source concept | Status |
|---|---|---|
| `actionId` | CAPA / corrective action identifier | Confirmed in schema |
| `triggerSampleId` | Sample that triggered the action | Confirmed in schema |
| `zoneId` | Zone affected | Confirmed in schema |
| `description` | Action description | Confirmed in schema |
| `assignedTo` | Person responsible | Confirmed in schema |
| `dueDate` | Target completion date | Confirmed in schema |
| `status` | `open` / `in-progress` / `completed` / `overdue` | Confirmed in schema |
| `completedAt` | Completion timestamp | Confirmed in schema |

---

## 9. `getEnvMonSwabVectors`

**Return type:** `EnvMonSwabVector[]`
**Panel:** Swab vectors panel
**Filters used:** `plantId`, `periodStart`, `periodEnd`
**Source badge:** `lims`

Swab vectors encode the trajectory of contamination findings — repeated positives at the same point, or spread between adjacent zones. This is the most semantically complex method and the hardest to implement without business rule confirmation.

| Contract field | Likely source concept | Status |
|---|---|---|
| `vectorId` | Vector / contamination chain identifier | Confirmed in schema |
| `fromLocationId` | Source sampling point | Confirmed in schema |
| `toLocationId` | Destination / affected point | Confirmed in schema |
| `strength` | Signal strength / correlation score | Confirmed in schema |
| `testType` | Organism type linking the events | Confirmed in schema |
| `eventCount` | Number of positive events in this vector | Confirmed in schema |

---

## Source Mapping Status Summary

| Method | Fields confirmed from schema | Fields mapped to view columns | Status |
|---|---|---|---|
| `getEnvMonContext` | Yes | **No** | Blocked — no source view |
| `getEnvMonSiteSummary` | Yes | **No** | Blocked — no source view |
| `getEnvMonZones` | Yes | **No** | Blocked — no source view |
| `getEnvMonAlerts` | Yes | **No** | Blocked — no source view |
| `getEnvMonSwabResults` | Yes | **No** | Blocked — no source view |
| `getEnvMonTrends` | Yes | **No** | Blocked — no source view |
| `getEnvMonHeatmap` | Yes | **No** | Blocked — no source view + floor plan risk |
| `getEnvMonCorrectiveActions` | Yes | **No** | Blocked — no source view |
| `getEnvMonSwabVectors` | Yes | **No** | Blocked — no source view + business rules undefined |

All methods are blocked on source view identification. Column mapping cannot proceed until `docs/audit/envmon-native-column-verification-checklist.md` has at least one `confirmed-ddl` entry.
