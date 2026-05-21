# SPC Data Model Grain Assessment

**Date:** 2026-05-21
**Status:** Pending Databricks verification — no grain has been confirmed by live query
**Catalog target:** `connected_plant_uat.gold`

> **IMPORTANT:** All grain candidates below are derived from V1 source code analysis only.
> No live Databricks query has been executed to confirm or deny any grain claim.
> The evidence and conclusion columns in all tables below must be filled in by a person
> with live Databricks SQL Warehouse access.

---

## 1. Purpose

This document defines the expected data grain for each primary SPC object in
`connected_plant_uat.gold`, explains why grain matters for V2 implementation, and provides SQL
queries to verify the grain claims before native V2 SPC routes are implemented.

Grain errors (incorrect grain assumptions) lead to:
- Silent row duplication or fan-out in aggregates
- Navigation model breakage (too many/too few rows per drill-down step)
- Incorrect capability calculations (if rows are not deduplicated correctly)
- Control chart rendering issues (plotting duplicate or missing points)

---

## 2. Grain Candidates by Object

### 2.1 `spc_quality_metric_subgroup_v`

**Expected grain (from V1 source):** One row per measurement sample point within a subgroup,
keyed by `(material_id, plant_id, mic_id, operation_id, batch_id, sample_id)`.

**Why grain matters for V2:**
- The V2 `ControlChartPoint` contract expects one point per timestamp per chart. If the grain is
  at a sub-sample level (e.g., one row per individual observation within a subgroup), then V2
  must group by `sample_id` or `batch_id` before plotting.
- If `subgroup_mean` is already aggregated per subgroup, a second GROUP BY in V2 would cause
  errors.
- The `subgroup_mean`, `subgroup_range`, and `subgroup_sd` columns suggest subgroup statistics
  have already been computed — implying the grain is per-subgroup, not per-individual-observation.
  This needs confirmation.

**Grain check queries:**

```sql
-- 1. Total row count
SELECT COUNT(*) AS total_rows
FROM connected_plant_uat.gold.spc_quality_metric_subgroup_v;

-- 2. Unique (material_id, plant_id, mic_id) combinations
SELECT COUNT(DISTINCT CONCAT(material_id, '|', plant_id, '|', mic_id))
  AS distinct_material_plant_mic_combinations
FROM connected_plant_uat.gold.spc_quality_metric_subgroup_v;

-- 3. Check if (material_id, plant_id, mic_id, operation_id, batch_id, sample_id) is unique
SELECT
  material_id,
  plant_id,
  mic_id,
  operation_id,
  batch_id,
  sample_id,
  COUNT(*) AS row_count
FROM connected_plant_uat.gold.spc_quality_metric_subgroup_v
GROUP BY material_id, plant_id, mic_id, operation_id, batch_id, sample_id
HAVING COUNT(*) > 1
ORDER BY row_count DESC
LIMIT 20;
-- If this returns rows: grain is NOT unique on this key combination
-- If this returns no rows: grain confirmed unique on this key combination

-- 4. Check subgroup sizes (are multiple result_values present per subgroup?)
SELECT
  material_id,
  plant_id,
  mic_id,
  batch_id,
  COUNT(*) AS samples_in_subgroup
FROM connected_plant_uat.gold.spc_quality_metric_subgroup_v
GROUP BY material_id, plant_id, mic_id, batch_id
ORDER BY samples_in_subgroup DESC
LIMIT 20;
-- This tells us whether subgroup_mean is already aggregated or if individual rows need grouping

-- 5. Date range of available data
SELECT
  material_id,
  plant_id,
  mic_id,
  MIN(sample_timestamp) AS earliest_sample,
  MAX(sample_timestamp) AS latest_sample,
  COUNT(*) AS total_samples,
  COUNT(DISTINCT batch_id) AS distinct_batches
FROM connected_plant_uat.gold.spc_quality_metric_subgroup_v
GROUP BY material_id, plant_id, mic_id
ORDER BY total_samples DESC
LIMIT 20;
```

### 2.2 `spc_locked_limits`

**Expected grain (from V1 source):** One row per `(material_id, mic_id, plant_id, operation_id, chart_type)`.
Multiple limit sets may exist for the same MIC if effective date ranges do not overlap.

**Why grain matters for V2:**
- The V2 `ControlChartSeries` expects a single set of control limits (UCL, LCL, CL) per chart.
  If multiple rows exist for the same (material, mic, plant, chart_type), V2 must select by
  effective date or version to avoid ambiguity.
- If `effective_from`/`effective_to` (or `baseline_from`/`baseline_to`) are present and allow
  multiple active rows, the V2 query must filter by current timestamp.

**Grain check queries:**

```sql
-- 1. Total row count
SELECT COUNT(*) AS total_rows
FROM connected_plant_uat.gold.spc_locked_limits;

-- 2. Check if PK (material_id, mic_id, plant_id, operation_id, chart_type) is unique
SELECT
  material_id,
  mic_id,
  plant_id,
  operation_id,
  chart_type,
  COUNT(*) AS row_count
FROM connected_plant_uat.gold.spc_locked_limits
GROUP BY material_id, mic_id, plant_id, operation_id, chart_type
HAVING COUNT(*) > 1
ORDER BY row_count DESC
LIMIT 20;
-- If rows returned: multiple limit sets per (material, mic, chart_type) exist
-- V2 query must filter by effective date

-- 3. Range of locked limits (check if any are expired)
SELECT
  COUNT(*) AS total_limit_rows,
  COUNT(DISTINCT material_id) AS distinct_materials,
  COUNT(DISTINCT mic_id) AS distinct_mics,
  COUNT(DISTINCT plant_id) AS distinct_plants
FROM connected_plant_uat.gold.spc_locked_limits;

-- 4. Sample the PK values
SELECT material_id, mic_id, plant_id, operation_id, chart_type, locked_at
FROM connected_plant_uat.gold.spc_locked_limits
ORDER BY locked_at DESC
LIMIT 20;
```

### 2.3 `spc_capability_detail_mv`

**Expected grain (from V1 source):** One row per `(material_id, plant_id, mic_id)`.
Represents the most recent computed capability metrics for that characteristic.

**Why grain matters for V2:**
- The V2 `CharacteristicCapability` contract expects a single Cp/Cpk/Pp/Ppk value per
  characteristic. If the MV has multiple rows per MIC (e.g., one per time window), V2 must
  select the most recent.
- The MV refresh cycle is 4 hours — values may be stale relative to subgroup data.

**Grain check queries:**

```sql
-- 1. Total row count
SELECT COUNT(*) AS total_rows
FROM connected_plant_uat.gold.spc_capability_detail_mv;

-- 2. Check if (material_id, plant_id, mic_id) is unique
SELECT
  material_id,
  plant_id,
  mic_id,
  COUNT(*) AS row_count
FROM connected_plant_uat.gold.spc_capability_detail_mv
GROUP BY material_id, plant_id, mic_id
HAVING COUNT(*) > 1
ORDER BY row_count DESC
LIMIT 20;

-- 3. Sample with capability values
SELECT
  material_id,
  plant_id,
  mic_id,
  cp,
  cpk,
  pp,
  ppk
FROM connected_plant_uat.gold.spc_capability_detail_mv
WHERE cpk IS NOT NULL
ORDER BY cpk DESC
LIMIT 20;
```

### 2.4 `spc_material_dim_mv`

**Expected grain:** One row per `material_id` that has SPC data.

```sql
SELECT COUNT(*) AS total_rows FROM connected_plant_uat.gold.spc_material_dim_mv;

SELECT material_id, COUNT(*) AS count
FROM connected_plant_uat.gold.spc_material_dim_mv
GROUP BY material_id
HAVING COUNT(*) > 1;
-- Should return no rows if grain is correct
```

### 2.5 `spc_characteristic_dim_mv`

**Expected grain:** One row per `(material_id, plant_id, mic_id)`.

```sql
SELECT COUNT(*) AS total_rows FROM connected_plant_uat.gold.spc_characteristic_dim_mv;

SELECT material_id, plant_id, mic_id, COUNT(*) AS count
FROM connected_plant_uat.gold.spc_characteristic_dim_mv
GROUP BY material_id, plant_id, mic_id
HAVING COUNT(*) > 1;
```

### 2.6 `spc_nelson_rule_flags_mv`

**Expected grain (from V1 source):** One row per `(material_id, plant_id, mic_id, batch_id)`.
This is a batch-level rule flag summary, not a point-level signal.

```sql
SELECT COUNT(*) AS total_rows FROM connected_plant_uat.gold.spc_nelson_rule_flags_mv;

SELECT material_id, plant_id, mic_id, batch_id, COUNT(*) AS count
FROM connected_plant_uat.gold.spc_nelson_rule_flags_mv
GROUP BY material_id, plant_id, mic_id, batch_id
HAVING COUNT(*) > 1;
```

---

## 3. Grain Conclusion Table

Fill in this table after running the grain check queries above.

| Object | Candidate Grain | Evidence Query | Result | Grain Confidence | V2 Impact |
|--------|----------------|----------------|--------|-----------------|-----------|
| `spc_quality_metric_subgroup_v` | `(material_id, plant_id, mic_id, operation_id, batch_id, sample_id)` | HAVING COUNT(*) > 1 on composite key | — not run — | unknown | V2 ControlChartPoint mapping depends on this. If subgroup_mean already computed, no re-aggregation needed. |
| `spc_locked_limits` | `(material_id, mic_id, plant_id, operation_id, chart_type)` per effective period | HAVING COUNT(*) > 1 on PK | — not run — | unknown | V2 must filter by effective date if multiple rows per MIC exist. |
| `spc_capability_detail_mv` | `(material_id, plant_id, mic_id)` most recent | HAVING COUNT(*) > 1 | — not run — | unknown | V2 expects one row per characteristic. If multiple, take MAX or latest. |
| `spc_material_dim_mv` | `material_id` | HAVING COUNT(*) > 1 | — not run — | unknown | Navigation layer — one row per material expected. |
| `spc_plant_material_dim_mv` | `(plant_id, material_id)` | HAVING COUNT(*) > 1 | — not run — | unknown | Navigation layer — must be unique per plant+material. |
| `spc_characteristic_dim_mv` | `(material_id, plant_id, mic_id)` | HAVING COUNT(*) > 1 | — not run — | unknown | MIC list — must be unique per material+plant+mic. |
| `spc_nelson_rule_flags_mv` | `(material_id, plant_id, mic_id, batch_id)` | HAVING COUNT(*) > 1 | — not run — | unknown | Batch-level rule flag summaries for scorecard colouring only. |

Grain confidence levels: `high` | `medium` | `low` | `unknown`

---

## 4. Grain Findings and V2 Recommendations

> This section is blank until evidence is captured. Do not fill in speculatively.

### 4.1 `spc_quality_metric_subgroup_v`

- **Verified grain:** — pending —
- **Subgroup mean pre-computed?** — pending —
- **V2 recommendation:** — pending —

### 4.2 `spc_locked_limits`

- **Verified grain:** — pending —
- **Multiple rows per MIC?** — pending —
- **Effective date filtering needed?** — pending —
- **V2 recommendation:** — pending —

### 4.3 `spc_capability_detail_mv`

- **Verified grain:** — pending —
- **Values populated?** — pending —
- **V2 recommendation:** — pending —
