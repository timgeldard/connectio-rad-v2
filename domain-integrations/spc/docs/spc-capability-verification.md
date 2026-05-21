# SPC Capability Calculation Verification

**Date:** 2026-05-21
**Status:** Pending Databricks verification — no capability values confirmed by live query
**Catalog target:** `connected_plant_uat.gold`

> **IMPORTANT:** All capability source claims below are derived from V1 source code analysis only.
> No live Databricks query has been executed to confirm that `spc_capability_detail_mv` exists,
> has columns, or contains computed values. All evidence fields must be filled in by a person
> with live Databricks access.

---

## 1. Purpose

This document establishes where Cp/Cpk/Pp/Ppk values come from in V1 before V2 implements
the `CharacteristicCapability` adapter methods. Key questions:

1. Are Cp/Cpk/Pp/Ppk stored in a Databricks object, or calculated on demand?
2. What is the source object and expected column names?
3. What sample window and spec limit source feeds the calculation?
4. Are computed values suitable for V2 display, or do they require re-validation?

---

## 2. V1 Capability Architecture (from source code analysis)

### 2.1 Storage: `spc_capability_detail_mv`

From `apps/spc/backend/spc_backend/process_control/dal/analysis.py` (V1 source):

The V1 scorecard endpoint (`/api/spc/scorecard`) queries `spc_capability_detail_mv` to return
pre-computed Cp/Cpk/Pp/Ppk values per (material_id, plant_id, mic_id) combination.

This is a **materialized view** refreshed on a 4-hour pipeline cycle, NOT calculated on demand.

### 2.2 Calculation: Python domain layer

From `apps/spc/backend/spc_backend/domain/capability.py` (V1 source):

V1 also has a Python domain module for capability calculation. This appears to be used for
on-demand calculation in analysis routes (`/api/spc/scorecard`), separate from the MV.

The relationship between the Python calculation and the pre-stored MV needs clarification:
- Does the scorecard endpoint read from `spc_capability_detail_mv` directly?
- Or does it re-calculate using the Python module?
- The V2 choice may differ: pre-stored MV is faster; on-demand calculation is more flexible.

### 2.3 Capability thresholds used in V1

From `apps/spc/backend/spc_backend/domain/capability.py` (V1 source):

| Interpretation | Threshold |
|----------------|-----------|
| `HIGHLY_CAPABLE` | Cpk >= 1.67 |
| `CAPABLE` | Cpk >= 1.33 |
| `MARGINAL` | 1.00 <= Cpk < 1.33 |
| `NOT_CAPABLE` | Cpk < 1.00 |

V2's `CharacteristicCapabilitySchema.interpretation` enum uses:
`capable` | `marginal` | `not-capable` | `insufficient-data`

The V1 `HIGHLY_CAPABLE` threshold (Cpk >= 1.67) has no V2 equivalent. V2 collapses it
into `capable`. This may lose nuance for process audits.

### 2.4 Spec limit source for capability

Capability indices require upper and lower specification limits (USL/LSL).

In V1 (from source analysis):
- USL/LSL come from `spc_quality_metric_subgroup_v.usl_spec` / `lsl_spec` columns
- OR from `spc_locked_limits.usl` / `lsl` (column name unconfirmed; see control-limit doc)
- The MV likely pre-joins these to pre-compute Cp/Cpk

**V2 risk:** If spec limits are NULL for some MICs in UAT, the MV will have NULL capability
values — `interpretation` would fall to `insufficient-data`.

---

## 3. Discovery Queries

### 3.1 Check for capability-related objects

```sql
SHOW TABLES IN connected_plant_uat.gold LIKE '*capability*';
SHOW TABLES IN connected_plant_uat.gold LIKE '*metric*';
SHOW TABLES IN connected_plant_uat.gold LIKE 'spc_capability*';
```

### 3.2 Confirm `spc_capability_detail_mv` type

```sql
DESCRIBE EXTENDED connected_plant_uat.gold.spc_capability_detail_mv;
-- Look for "Type" = MATERIALIZED_VIEW
```

### 3.3 Column schema

```sql
DESCRIBE TABLE connected_plant_uat.gold.spc_capability_detail_mv;
```

Expected columns (from V1 `analysis.py`):
`material_id`, `plant_id`, `mic_id`, `mic_name`, `cp`, `cpk`, `pp`, `ppk`,
`sample_count`, `mean`, `sigma_within`

### 3.4 DDL

```sql
SHOW CREATE TABLE connected_plant_uat.gold.spc_capability_detail_mv;
```

### 3.5 Sample capability values

```sql
SELECT *
FROM connected_plant_uat.gold.spc_capability_detail_mv
LIMIT 20;
```

### 3.6 Are Cp/Cpk values populated?

```sql
SELECT
  COUNT(*) AS total_rows,
  SUM(CASE WHEN cp IS NOT NULL THEN 1 ELSE 0 END) AS has_cp,
  SUM(CASE WHEN cpk IS NOT NULL THEN 1 ELSE 0 END) AS has_cpk,
  SUM(CASE WHEN pp IS NOT NULL THEN 1 ELSE 0 END) AS has_pp,
  SUM(CASE WHEN ppk IS NOT NULL THEN 1 ELSE 0 END) AS has_ppk,
  SUM(CASE WHEN sample_count IS NOT NULL THEN 1 ELSE 0 END) AS has_sample_count
FROM connected_plant_uat.gold.spc_capability_detail_mv;
```

### 3.7 MV freshness check

```sql
-- If the MV was recently refreshed, it should have recent last_updated or similar column
-- First check what columns exist (DESCRIBE TABLE above), then query the freshness indicator
-- If no freshness column: compare max(sample_count) against spc_quality_metric_subgroup_v counts
```

---

## 4. Capability Mapping Table

Fill in after running queries.

| Capability Metric | Source | Calculation Method | Sample Size | Date Window | Spec Limit Source | Confidence | V2 Treatment |
|-------------------|--------|--------------------|-------------|-------------|-------------------|------------|--------------|
| `cp` (process capability) | `spc_capability_detail_mv.cp` | (USL−LSL) / (6 * sigma_within) | From `sample_count` | MV window (unconfirmed) | `usl_spec/lsl_spec` or `spc_locked_limits` | pending verification | — |
| `cpk` (capability with centring) | `spc_capability_detail_mv.cpk` | min((USL−X̄)/3σ, (X̄−LSL)/3σ) | From `sample_count` | MV window | As above | pending verification | — |
| `pp` (performance index) | `spc_capability_detail_mv.pp` | (USL−LSL) / (6 * sigma_overall) | From `sample_count` | MV window | As above | pending verification | — |
| `ppk` (performance with centring) | `spc_capability_detail_mv.ppk` | min((USL−X̄)/3s, (X̄−LSL)/3s) | From `sample_count` | MV window | As above | pending verification | — |
| `mean` | `spc_capability_detail_mv.mean` | Arithmetic mean of result_value | From `sample_count` | MV window | N/A | pending verification | — |
| `standardDeviation` | `spc_capability_detail_mv.sigma_within` (expected) | Within-subgroup pooled sigma | From `sample_count` | MV window | N/A | pending verification | — |
| `sampleCount` | `spc_capability_detail_mv.sample_count` | COUNT of observations | Direct | MV window | N/A | pending verification | — |
| `interpretation` | Derived in V2 from `cpk` | Threshold: >= 1.33 = capable, 1.0–1.33 = marginal, < 1.0 = not-capable | N/A | N/A | N/A | pending verification | Calculate in V2 backend after validation |
| `confidence` | Derived in V2 | Data completeness ratio | N/A | N/A | N/A | pending verification | Calculate in V2 |

V2 treatment options: `show as verified` | `show as exploratory` | `show as unavailable` | `defer` | `calculate in V2 backend after validation`

---

## 5. Capability Evidence Capture

Fill in after running queries.

| Check | Status | Finding | Date | Verified By |
|-------|--------|---------|------|-------------|
| `spc_capability_detail_mv` exists in catalog | not run | — | — | — |
| Object type confirmed as MATERIALIZED_VIEW | not run | — | — | — |
| Columns match expected schema (`cp`, `cpk`, `pp`, `ppk`, `sample_count`, `mean`, `sigma_within`) | not run | — | — | — |
| At least one row with non-NULL `cpk` | not run | — | — | — |
| Spec limit source for Cp/Cpk identified (usl_spec/lsl_spec vs spc_locked_limits) | not run | — | — | — |
| MV refresh cycle confirmed (expected: 4h) | not run | — | — | — |
| Sample window / date range captured | not run | — | — | — |
