# EnvMon Native Databricks Column Verification Checklist

**Date:** 2026-05-17 (i.txt) | **Corrected:** 2026-05-17 (k.txt SAP QM recovery)
**Status:** CONFIRMED-V1 — DDL NOT YET RUN in connected_plant_uat
**Reference:** `docs/audit/envmon-sap-qm-source-model.md`, `docs/audit/envmon-databricks-source-candidates.md`

**Legend:**
- `confirmed-v1` — confirmed from V1 ConnectIO-RAD source code or entities.yaml; not yet DDL-verified
- `confirmed-ddl` — verified via `DESCRIBE TABLE` or `SHOW COLUMNS IN` in the live workspace
- `confirmed-browser` — field value confirmed in a live API response in the browser
- `assumed` — inferred from naming convention or prior knowledge; not verified
- `missing` — expected field not found in the view DDL
- `blocked` — cannot verify until another dependency is resolved

Do not mark any field `confirmed-ddl` unless you have run the DDL command and seen the column name in the output.

---

## Primary Views (confirmed-v1 — DDL pending)

### `gold_inspection_lot` (TRACE_CATALOG.TRACE_SCHEMA)

```sql
DESCRIBE TABLE connected_plant_uat.gold.gold_inspection_lot;

SELECT * FROM connected_plant_uat.gold.gold_inspection_lot LIMIT 5;

-- Confirm filter values
SELECT DISTINCT INSPECTION_TYPE, COUNT(*) AS n
FROM connected_plant_uat.gold.gold_inspection_lot
GROUP BY INSPECTION_TYPE ORDER BY n DESC;

-- Confirm plant-level data exists
SELECT PLANT_ID, INSPECTION_TYPE, COUNT(*) AS n
FROM connected_plant_uat.gold.gold_inspection_lot
WHERE INSPECTION_TYPE IN ('14','Z14')
GROUP BY PLANT_ID, INSPECTION_TYPE
ORDER BY PLANT_ID;
```

| Contract concept | Column name | Status |
|---|---|---|
| Lot identifier | `INSPECTION_LOT_ID` | `confirmed-v1` |
| Plant | `PLANT_ID` | `confirmed-v1` |
| Inspection type (domain filter) | `INSPECTION_TYPE` | `confirmed-v1` |
| Period start filter | `CREATED_DATE` | `confirmed-v1` |
| Lot completion date | `INSPECTION_END_DATE` | `confirmed-v1` |
| Material | `MATERIAL_ID` | `confirmed-v1` |
| Batch | `BATCH_ID` | `confirmed-v1` |

---

### `gold_inspection_point` (TRACE_CATALOG.TRACE_SCHEMA)

```sql
DESCRIBE TABLE connected_plant_uat.gold.gold_inspection_point;

SELECT * FROM connected_plant_uat.gold.gold_inspection_point LIMIT 5;

-- Confirm functional location is populated
SELECT COUNT(*) AS n, COUNT(FUNCTIONAL_LOCATION) AS with_loc
FROM connected_plant_uat.gold.gold_inspection_point
WHERE INSPECTION_LOT_ID IN (
    SELECT INSPECTION_LOT_ID FROM connected_plant_uat.gold.gold_inspection_lot
    WHERE INSPECTION_TYPE IN ('14','Z14') LIMIT 100
);
```

| Contract concept | Column name | Status |
|---|---|---|
| Lot FK | `INSPECTION_LOT_ID` | `confirmed-v1` |
| Point identifier | `INSPECTION_POINT_ID` | `confirmed-v1` |
| Physical location (SAP TPLNR) | `FUNCTIONAL_LOCATION` | `confirmed-v1` |
| Join key to result_v (part 2) | `OPERATION_ID` | `confirmed-v1` |
| Join key to result_v (part 3) | `SAMPLE_ID` | `confirmed-v1` |
| Sample hour | `SAMPLE_HOUR` | `confirmed-v1` |

---

### `gold_batch_quality_result_v` (TRACE_CATALOG.TRACE_SCHEMA)

```sql
DESCRIBE TABLE connected_plant_uat.gold.gold_batch_quality_result_v;

SELECT * FROM connected_plant_uat.gold.gold_batch_quality_result_v LIMIT 5;

-- Confirm valuation values
SELECT DISTINCT INSPECTION_RESULT_VALUATION, COUNT(*) AS n
FROM connected_plant_uat.gold.gold_batch_quality_result_v
GROUP BY INSPECTION_RESULT_VALUATION ORDER BY n DESC;

-- Confirm MIC names (organism/test types)
SELECT DISTINCT MIC_NAME, COUNT(*) AS n
FROM connected_plant_uat.gold.gold_batch_quality_result_v
WHERE INSPECTION_LOT_ID IN (
    SELECT INSPECTION_LOT_ID FROM connected_plant_uat.gold.gold_inspection_lot
    WHERE INSPECTION_TYPE IN ('14','Z14') LIMIT 100
)
GROUP BY MIC_NAME ORDER BY n DESC;
```

| Contract concept | Column name | Status |
|---|---|---|
| Join key (part 1) | `INSPECTION_LOT_ID` | `confirmed-v1` |
| Join key (part 2) | `OPERATION_ID` | `confirmed-v1` |
| Join key (part 3) | `SAMPLE_ID` | `confirmed-v1` |
| Test type / organism | `MIC_NAME` | `confirmed-v1` |
| Result status | `INSPECTION_RESULT_VALUATION` | `confirmed-v1` |
| Numeric result value | `QUANTITATIVE_RESULT` | `confirmed-v1` |
| Upper specification limit | `UPPER_TOLERANCE` | `confirmed-v1` |
| Lower specification limit | `LOWER_TOLERANCE` | `confirmed-v1` |

**Valuation mapping (confirmed-v1):**
| Raw value | V2 contract result |
|---|---|
| `R`, `REJ`, `REJECT` | `positive` (fail) |
| `W`, `WARN` | `borderline` (warning) |
| `A` (or other non-null) | `negative` (pass) |
| NULL | `pending` |

---

## App-Managed Tables (existence UNKNOWN in connected_plant_uat)

Run this first:
```sql
SHOW TABLES IN connected_plant_uat.gold LIKE 'em_%';
```

If em_* tables exist, run DDL. If not, heatmap and zone methods remain blocked.

### `em_location_coordinates` (EM_CATALOG.EM_SCHEMA — if exists)

```sql
DESCRIBE TABLE connected_plant_uat.gold.em_location_coordinates;
SELECT * FROM connected_plant_uat.gold.em_location_coordinates LIMIT 20;
```

| Field | Column | Status |
|---|---|---|
| Location (TPLNR) link | `func_loc_id` | `confirmed-v1` (V1 entities.yaml) |
| Floor | `floor_id` | `confirmed-v1` |
| X position (%) | `x_pos` | `confirmed-v1` |
| Y position (%) | `y_pos` | `confirmed-v1` |
| Plant | `plant_id` | `confirmed-v1` |
| View existence in UAT | — | **blocked — run `SHOW TABLES` first** |

### `em_plant_floor` (EM_CATALOG.EM_SCHEMA — if exists)

```sql
DESCRIBE TABLE connected_plant_uat.gold.em_plant_floor;
SELECT * FROM connected_plant_uat.gold.em_plant_floor LIMIT 20;
```

| Field | Column | Status |
|---|---|---|
| Plant | `plant_id` | `confirmed-v1` |
| Floor | `floor_id` | `confirmed-v1` |
| Floor name | `floor_name` | `confirmed-v1` |
| SVG URL | `svg_url` | `confirmed-v1` |
| SVG dimensions | `svg_width`, `svg_height` | `confirmed-v1` |
| Active revision | `active_revision_id` | `confirmed-v1` |
| View existence in UAT | — | **blocked — run `SHOW TABLES` first** |

---

## Lot-Type Filter Verification

```sql
-- Step 1: Confirm INSPECTION_TYPE column exists and has '14'/'Z14' values
SELECT DISTINCT INSPECTION_TYPE, COUNT(*) AS n
FROM connected_plant_uat.gold.gold_inspection_lot
GROUP BY INSPECTION_TYPE ORDER BY n DESC;

-- Step 2: Confirm data volume for EnvMon lot types
SELECT PLANT_ID, COUNT(*) AS lot_count, MIN(CREATED_DATE) AS earliest, MAX(CREATED_DATE) AS latest
FROM connected_plant_uat.gold.gold_inspection_lot
WHERE INSPECTION_TYPE IN ('14','Z14')
GROUP BY PLANT_ID ORDER BY PLANT_ID;
```

Update `docs/audit/envmon-inspection-lot-type-filter.md` status after running step 1.

---

## Site Summary End-to-End Test

Once all three primary views are confirmed-ddl, run the full site summary query:

```sql
-- Test the full site summary query for a known plant (replace C061 with real plant)
WITH base AS (
    SELECT
        ip.FUNCTIONAL_LOCATION        AS func_loc_id,
        r.INSPECTION_RESULT_VALUATION AS valuation,
        lot.INSPECTION_LOT_ID         AS lot_id
    FROM connected_plant_uat.gold.gold_inspection_lot lot
    JOIN connected_plant_uat.gold.gold_inspection_point ip
        ON lot.INSPECTION_LOT_ID = ip.INSPECTION_LOT_ID
    LEFT JOIN connected_plant_uat.gold.gold_batch_quality_result_v r
        ON ip.INSPECTION_LOT_ID = r.INSPECTION_LOT_ID
       AND ip.OPERATION_ID      = r.OPERATION_ID
       AND ip.SAMPLE_ID         = r.SAMPLE_ID
    WHERE lot.PLANT_ID = 'C061'
      AND lot.INSPECTION_TYPE IN ('14','Z14')
      AND ip.FUNCTIONAL_LOCATION IS NOT NULL
      AND lot.CREATED_DATE >= DATEADD(DAY, -90, CURRENT_DATE)
),
loc_status AS (
    SELECT
        func_loc_id,
        MAX(CASE WHEN valuation IN ('R','REJ','REJECT') THEN 1 ELSE 0 END) AS is_fail,
        MAX(CASE WHEN valuation IN ('W','WARN')         THEN 1 ELSE 0 END) AS is_warn,
        COUNT(DISTINCT lot_id)                                              AS lot_count
    FROM base GROUP BY func_loc_id
)
SELECT COUNT(*) AS total_locs, SUM(is_fail) AS active_fails, SUM(lot_count) AS lots_tested
FROM loc_status;
```

If this returns rows, the QuerySpec is ready for route wiring. Update `adapter-source-status-matrix.md` and `domain-source-truth-matrix.md` status accordingly.

---

## How to Update This Checklist

1. Run `DESCRIBE TABLE` for each view in the Databricks SQL Editor.
2. For each column found, change status from `confirmed-v1` to `confirmed-ddl` and record the date.
3. For enums, run `SELECT DISTINCT` and verify values match expectations.
4. If a column is not found, mark `missing` and note the date — do not wire that field.
5. Do not wire any QuerySpec or route until all required fields for that slice are `confirmed-ddl`.

After DDL confirmation, update `docs/audit/envmon-databricks-source-candidates.md` statuses and `docs/migration/envmon-native-candidate-ranking.md`.
