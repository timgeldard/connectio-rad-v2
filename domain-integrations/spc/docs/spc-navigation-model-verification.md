# SPC Navigation Model Verification

**Date:** 2026-05-21
**Status:** Pending Databricks verification — no navigation model has been confirmed by live query
**Catalog target:** `connected_plant_uat.gold`

> **IMPORTANT:** All navigation model claims below are derived from V1 source code analysis only.
> No live Databricks query has been executed to prove or disprove the navigation hierarchy.
> All evidence columns must be filled in by a person with live Databricks SQL Warehouse access.

---

## 1. Purpose

This document provides SQL queries to prove or disprove the V1 SPC navigation model:

```
material_id → plant_id → mic_id → operation_id → chart_type
```

This navigation hierarchy is the critical structural assumption for V2 SPC implementation.
If the data does not support this model (e.g., there are no materials with SPC data, or
mic_ids are not scoped per plant), the V2 integration design must be revised.

---

## 2. The Navigation Model

### 2.1 V1 Navigation (source-confirmed from code analysis)

From `apps/spc/frontend/src/spc/SPCFilterBar.tsx` and `SPCContext.tsx`:

1. **User selects material**: `GET /api/spc/materials` → returns `spc_material_dim_mv`
2. **User selects plant**: `GET /api/spc/plants?material_id=<id>` → returns `spc_plant_material_dim_mv`
3. **User selects MIC**: `GET /api/spc/characteristics?material_id=<id>&plant_id=<id>` → returns `spc_characteristic_dim_mv`
4. **User selects date range**: scopes `spc_quality_metric_subgroup_v` query
5. **Chart renders**: `POST /api/spc/chart-data` with `{material_id, mic_id, plant_id, operation_id, chart_type, date_from, date_to}`

### 2.2 V2 Current Model (as-built — needs updating)

From `domain-integrations/spc/src/adapters/spc-monitoring-adapter.ts`:
- V2 currently uses `plantId` + `workCentreId` as primary scope
- `materialId` is present in `SPCMonitoringContextSchema` but not as primary entry-point
- `characteristicId` maps to `mic_id`

### 2.3 Gap

V2 must adopt material-first navigation to match V1. This requires:
1. `materialId` as required primary parameter in `SPCMonitoringAdapterRequest`
2. Plant picker driven by selected material (not site-level scope)
3. MIC list scoped to selected material + plant combination
4. `workCentreId` → `operation_id` mapping (these are different concepts; `operation_id` is
   an SAP QM inspection operation step, not a manufacturing work centre)

---

## 3. Navigation Verification Queries

### 3.1 Level 1: What materials exist with SPC data?

```sql
-- Distinct materials in the dimension MV
SELECT
  material_id,
  COUNT(*) AS mic_rows
FROM connected_plant_uat.gold.spc_material_dim_mv
GROUP BY material_id
ORDER BY mic_rows DESC
LIMIT 20;
```

```sql
-- Alternatively, derive from the subgroup view directly (more accurate but slower)
SELECT DISTINCT
  material_id
FROM connected_plant_uat.gold.spc_quality_metric_subgroup_v
ORDER BY material_id
LIMIT 20;
```

### 3.2 Level 2: For a given material, which plants have SPC data?

Replace `'<candidate_material>'` with a real material_id from Step 3.1.

```sql
SELECT DISTINCT
  material_id,
  plant_id
FROM connected_plant_uat.gold.spc_quality_metric_subgroup_v
WHERE material_id = '<candidate_material>'
ORDER BY plant_id;
```

```sql
-- Or use the dimension MV
SELECT DISTINCT
  material_id,
  plant_id
FROM connected_plant_uat.gold.spc_plant_material_dim_mv
WHERE material_id = '<candidate_material>'
ORDER BY plant_id;
```

### 3.3 Level 3: For a material + plant, which MICs have SPC data?

Replace with actual candidate values.

```sql
SELECT DISTINCT
  material_id,
  plant_id,
  mic_id,
  operation_id
FROM connected_plant_uat.gold.spc_quality_metric_subgroup_v
WHERE material_id = '<candidate_material>'
  AND plant_id = '<candidate_plant>'
ORDER BY mic_id;
```

```sql
-- Or use the characteristic dimension MV
SELECT
  material_id,
  plant_id,
  mic_id,
  operation_id
FROM connected_plant_uat.gold.spc_characteristic_dim_mv
WHERE material_id = '<candidate_material>'
  AND plant_id = '<candidate_plant>'
ORDER BY mic_id;
```

### 3.4 Level 4: Full drill-down — subgroup data for one MIC

Replace all candidate values from Steps 3.1–3.3.

```sql
SELECT
  material_id,
  plant_id,
  mic_id,
  operation_id,
  batch_id,
  sample_id,
  sample_timestamp,
  result_value,
  subgroup_mean,
  subgroup_range,
  subgroup_sd,
  unit_of_measure,
  usl_spec,
  lsl_spec
FROM connected_plant_uat.gold.spc_quality_metric_subgroup_v
WHERE material_id = '<candidate_material>'
  AND plant_id   = '<candidate_plant>'
  AND mic_id     = '<candidate_mic>'
ORDER BY sample_timestamp DESC
LIMIT 50;
```

### 3.5 Check operation_id values (for workCentreId mapping)

```sql
SELECT DISTINCT
  material_id,
  plant_id,
  mic_id,
  operation_id
FROM connected_plant_uat.gold.spc_quality_metric_subgroup_v
WHERE material_id = '<candidate_material>'
ORDER BY operation_id;
```

This determines what values `operation_id` takes and whether they look like SAP inspection
operation steps (e.g., `0010`, `0020`) or work centre codes.

---

## 4. Navigation Model Decision Criteria

### 4.1 materialId prioritisation

**Proceed with material-first navigation if:**
- `spc_material_dim_mv` has rows, OR
- `spc_quality_metric_subgroup_v` has DISTINCT material_id values

**Blocked if:**
- No materials found in either source

### 4.2 workCentreId / operationId mapping

| Finding | V2 Decision |
|---------|-------------|
| `operation_id` is NULL for all rows | Drop operation scope from V2 request; use material+plant+mic only |
| `operation_id` values look like SAP step codes (e.g., `0010`, `0020`) | Rename V2 field from `workCentreId` to `operationId`; update adapter request |
| `operation_id` values match plant work centres | Map `workCentreId` to `operation_id` directly |
| `operation_id` not present as column | Column was not in deployed DDL; mark as unverified |

### 4.3 characteristicId / micId mapping

V2 uses `characteristicId` as the primary field; V1 uses `mic_id`.

**Confirmed mapping from V1 source analysis:**
- V2 `characteristicId` = V1 `mic_id`
- V2 `micId` (optional) = V1 `mic_id`
- These are the same value; the distinction is cosmetic

**This must be confirmed by verifying that `spc_characteristic_dim_mv.mic_id` values match
the values expected in V2 characteristic pickers.**

---

## 5. Navigation Evidence Table

Fill in after running queries.

| Navigation Level | Query Run | Result | Notes | Verified By | Date |
|------------------|-----------|--------|-------|-------------|------|
| Materials exist in `spc_material_dim_mv` | DISTINCT material_id | — not run — | | | |
| Plants per material in `spc_plant_material_dim_mv` | WHERE material_id = candidate | — not run — | | | |
| MICs per material+plant in `spc_characteristic_dim_mv` | WHERE material_id + plant_id | — not run — | | | |
| operation_id values (type/format) | DISTINCT operation_id | — not run — | | | |
| Subgroup data exists for candidate | Full drill-down query | — not run — | | | |
| material_id is required for correct scoping | Cross-plant COUNT check | — not run — | | | |

---

## 6. Navigation Model Conclusion

> This section is blank until evidence is captured. Do not fill in speculatively.

- **Verified navigation hierarchy:** — pending —
- **materialId required as primary entry?** — pending —
- **workCentreId maps to operation_id?** — pending —
- **operation_id format:** — pending —
- **characteristicId = mic_id confirmed?** — pending —
- **V2 adapter request changes needed:** — pending —
