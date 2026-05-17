# Native Databricks Column Verification Checklist

**Date:** 2026-05-17
**Status:** CQ lab plants columns confirmed-v1; all others ASSUMED — none confirmed from live DDL
**Reference:** ADR-025, `apps/api/adapters/poh/poh_databricks_adapter.py`, `apps/api/adapters/cq/cq_databricks_adapter.py`

**Legend:**
- `confirmed-ddl` — verified via `DESCRIBE TABLE` or `SHOW COLUMNS IN` in the live workspace
- `confirmed-v1` — field name confirmed from V1 source only (not Unity Catalog DDL)
- `assumed` — inferred from SAP naming convention or prior knowledge; not verified
- `missing` — expected field not found in any available source
- `blocked` — cannot verify until a prerequisite view/table exists

---

## POH — `getProcessOrderHeader`

**QuerySpec:** `poh.get_process_order_header` in `apps/api/adapters/poh/poh_databricks_adapter.py`
**Source view:** `connected_plant_uat.vw_gold_process_order`
**FastAPI route:** `POST /api/por/order-header`

Verify columns with:
```sql
DESCRIBE TABLE connected_plant_uat.vw_gold_process_order;
-- or
SELECT * FROM connected_plant_uat.vw_gold_process_order LIMIT 1;
```

| Contract field | SQL alias | Assumed source column | Status | Verified date |
|---------------|-----------|----------------------|--------|--------------|
| `processOrderId` | `process_order_id` | `aufnr` | **assumed** | — |
| `orderType` | `order_type` | `auart` | **assumed** | — |
| `materialId` | `material_id` | `matnr` | **assumed** | — |
| `materialDescription` | `material_description` | `maktx` | **assumed** | — |
| `plantId` | `plant_id` | `werks` | **assumed** | — |
| `productionLine` | `production_line` | `arbpl` | **assumed** | — |
| `plannedQuantity` | `planned_quantity` | `gamng` | **assumed** | — |
| `uom` | `uom` | `gmein` | **assumed** | — |
| `confirmedQuantity` | `confirmed_quantity` | `wemng` | **assumed** | — |
| `plannedStart` | `planned_start` | `gstrp` | **assumed** | — |
| `plannedFinish` | `planned_finish` | `gltrp` | **assumed** | — |
| `actualStart` | `actual_start` | `gstri` | **assumed** | — |
| `actualFinish` | `actual_finish` | `getri` | **assumed** | — |
| `orderStatusRaw` | `order_status_raw` | `objnr` | **assumed** | — |
| `batch` | `batch` | `charg` | **assumed** | — |

**Status mapping note:** `order_status_raw` → `orderStatus` is computed in `map_process_order_header_rows()` via `_ORDER_STATUS_MAP`. The raw value in `vw_gold_process_order` may be a text status code (REL, CRTD, CNF...) or an SAP object number (`objnr`). Verify by inspecting sample rows — the gold view may already expose a decoded status field.

**Verification SQL to run:**
```sql
-- Step 1: confirm columns exist
DESCRIBE TABLE connected_plant_uat.vw_gold_process_order;

-- Step 2: inspect status values for the mapping
SELECT DISTINCT order_status_raw
FROM connected_plant_uat.vw_gold_process_order
LIMIT 20;

-- Step 3: test the full query with a known process order
SELECT
    aufnr AS process_order_id,
    auart AS order_type,
    matnr AS material_id,
    maktx AS material_description,
    werks AS plant_id,
    arbpl AS production_line,
    gamng AS planned_quantity,
    gmein AS uom,
    wemng AS confirmed_quantity,
    gstrp AS planned_start,
    gltrp AS planned_finish,
    gstri AS actual_start,
    getri AS actual_finish,
    objnr AS order_status_raw,
    charg AS batch
FROM connected_plant_uat.vw_gold_process_order
WHERE aufnr = '<known-order-id>'
LIMIT 1;
```

---

## CQ Lab — `getLabPlants`

**QuerySpec:** `cq.get_lab_plants` in `apps/api/adapters/cq/cq_databricks_adapter.py`
**Source table:** `` `{CQ_CATALOG}`.`gold`.`gold_plant` `` (e.g. `connected_plant_uat.gold.gold_plant`)
**FastAPI route:** `GET /api/cq/lab/plants`

Verify columns with:
```sql
DESCRIBE TABLE connected_plant_uat.gold.gold_plant;
-- or
SELECT * FROM connected_plant_uat.gold.gold_plant LIMIT 5;
```

| Contract field | SQL alias | Source column | Status | Verified date |
|---------------|-----------|--------------|--------|--------------|
| `plantId` | `plant_id` | `PLANT_ID` | **confirmed-v1** | 2026-05-17 |
| `plantName` | `plant_name` | `PLANT_NAME` | **confirmed-v1** | 2026-05-17 |

**Confirmation source:** V1 DAL query — `` SELECT PLANT_ID AS plant_id, PLANT_NAME AS plant_name FROM `{CQ_CATALOG}`.`gold`.`gold_plant` WHERE PLANT_ID IS NOT NULL ORDER BY PLANT_ID ``.

**Verification SQL to run (live DDL confirmation):**
```sql
-- Step 1: confirm columns
DESCRIBE TABLE connected_plant_uat.gold.gold_plant;

-- Step 2: test the full query
SELECT
    PLANT_ID   AS plant_id,
    PLANT_NAME AS plant_name
FROM connected_plant_uat.gold.gold_plant
WHERE PLANT_ID IS NOT NULL
ORDER BY PLANT_ID
LIMIT 100;
```

---

## Trace — QuerySpec-only slices (route not wired)

These slices have QuerySpec factories in `apps/api/adapters/trace/` but no FastAPI route wiring yet. Column names are not confirmed.

### `getBatchHeaderSummary`

**Source view:** `gold_batch_summary_v` (assumed) in `csm_process_order_history` or equivalent
**QuerySpec:** `trace.get_batch_header_summary`

| Contract field | Assumed source column | Status |
|---------------|----------------------|--------|
| `batchId` | `charg` | **assumed** |
| `materialId` | `matnr` | **assumed** |
| `materialDescription` | `maktx` | **assumed** |
| `plantId` | `werks` | **assumed** |
| `status` | (view-specific) | **assumed** |
| `quantity` | (view-specific) | **assumed** |

### `getTraceGraph` (depth=1)

**Source view:** `gold_batch_lineage`

| Contract field | Assumed source column | Status |
|---------------|----------------------|--------|
| Node/edge structure | (view-specific) | **assumed** |

### `getMassBalanceSummary`

**Source view:** `gold_batch_mass_balance_v`

| Contract field | Assumed source column | Status |
|---------------|----------------------|--------|
| Input/output quantities | (view-specific) | **assumed** |

---

## How to update this checklist

When a column is verified:

1. Run `DESCRIBE TABLE <catalog>.<schema>.<view>` in the Databricks workspace.
2. Confirm the column name matches the SQL alias in the QuerySpec.
3. Update the `Status` column to `confirmed-ddl` and add the `Verified date`.
4. If a column name differs from the assumed value, update the `poh_databricks_adapter.py` or `cq_databricks_adapter.py` SQL.
5. Remove the `-- TODO: verify` comment from the SQL in the adapter file.
6. Re-run tests: `python -m pytest apps/api/tests/ -q`.

Do not mark any field `confirmed-ddl` unless you have run the DDL command and seen the column name in the output. Do not infer from V1 field names alone.
