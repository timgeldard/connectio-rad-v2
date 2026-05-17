# Native Databricks Column Verification Checklist

**Date:** 2026-05-17 (updated — POH operations DDL confirmed, confirmations/movements blocked)
**Status:** POH header + operations columns confirmed-ddl; CQ lab plants confirmed-v1; confirmations + movements blocked (no DDL)
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

| Contract field | SQL alias | Source column | Status | Verified date |
|---------------|-----------|--------------|--------|--------------|
| `processOrderId` | `process_order_id` | `PROCESS_ORDER_ID` | **confirmed-ddl** | 2026-05-17 |
| `orderType` | — | not in view | **missing** | 2026-05-17 |
| `materialId` | `material_id` | `MATERIAL_ID` | **confirmed-ddl** | 2026-05-17 |
| `materialDescription` | `material_description` | `MATERIAL_DESCRIPTION` | **confirmed-ddl** | 2026-05-17 |
| `plantId` | `plant_id` | `PLANT_ID` | **confirmed-ddl** | 2026-05-17 |
| `productionLine` | — | not in view | **missing** | 2026-05-17 |
| `plannedQuantity` | — | not in view | **missing** | 2026-05-17 |
| `uom` | — | not in view | **missing** | 2026-05-17 |
| `confirmedQuantity` | — | not in view | **missing** | 2026-05-17 |
| `plannedStart` | — | not in view | **missing** | 2026-05-17 |
| `plannedFinish` | — | not in view | **missing** | 2026-05-17 |
| `actualStart` | — | not in view | **missing** | 2026-05-17 |
| `actualFinish` | — | not in view | **missing** | 2026-05-17 |
| `orderStatus` | `order_status_raw` → mapped | `STATUS` | **confirmed-ddl** | 2026-05-17 |
| `inspectionLotId` | `inspection_lot_id` | `INSPECTION_LOT_ID` | **confirmed-ddl** | 2026-05-17 |

**DDL evidence:** `DESCRIBE TABLE connected_plant_uat.csm_process_order_history.vw_gold_process_order` run 2026-05-17. Columns present: `PROCESS_ORDER_ID`, `STATUS`, `MATERIAL_ID`, `MATERIAL_DESCRIPTION`, `PLANT_ID`, `INSPECTION_LOT_ID`. Missing fields return empty/zero defaults by design until a richer view is available.

**Status mapping:** `STATUS` text values (e.g. `"IN PROGRESS"`, `"CLOSED"`) → V2 enum via `_ORDER_STATUS_MAP`. Browser-verified: `"CLOSED"` returned as `"closed"` for process order 7006965038 (2026-05-17).

---

## POH — `getOrderOperations`

**QuerySpec:** `poh.get_order_operations` in `apps/api/adapters/poh/poh_databricks_adapter.py`
**Source view:** `connected_plant_uat.csm_process_order_history.vw_gold_process_order_phase`
**FastAPI route:** `GET /api/por/order-operations?process_order_id=...`

**DDL evidence:** `DESCRIBE TABLE connected_plant_uat.csm_process_order_history.vw_gold_process_order_phase` run 2026-05-17. All columns below are confirmed-ddl.

| Contract field | SQL alias | Source column | Status | Verified date |
|---------------|-----------|--------------|--------|--------------|
| `operationId` | `operation_id` | `PROCESS_ORDER_PHASE_ID` | **confirmed-ddl** | 2026-05-17 |
| `operationNumber` | `operation_number` | `PHASE_ID` | **confirmed-ddl** | 2026-05-17 |
| `operationText` | `operation_text` | `PHASE_DESCRIPTION` | **confirmed-ddl** | 2026-05-17 |
| `workCentre` | — | not in view | **missing** | 2026-05-17 |
| `plannedStart` | — | not in view | **missing** | 2026-05-17 |
| `plannedFinish` | — | not in view | **missing** | 2026-05-17 |
| `plannedDurationMinutes` | — | not in view | **missing** | 2026-05-17 |
| `status` | inferred | `START_USER` + `END_USER` | **confirmed-ddl** | 2026-05-17 |
| `confirmationStatus` | inferred | `START_USER` + `END_USER` | **confirmed-ddl** | 2026-05-17 |
| `confirmed` | inferred | `END_USER` presence | **confirmed-ddl** | 2026-05-17 |
| `hasException` | — | not in view | **missing** | 2026-05-17 |

**Status inference logic:** `END_USER` populated → `confirmed` / `final-confirmed`; `START_USER` only → `in-progress` / `partially-confirmed`; neither → `pending` / `unconfirmed`. This is a conservative inference, not a direct SAP status field.

**Browser verification:** PASSED 2026-05-17 — 11 operations returned for PO 7006965038; `X-Data-Source: databricks-api` and `X-Query-Name: poh.get_order_operations` confirmed in response headers.

---

## POH — `getOrderConfirmations` — BLOCKED

**Candidate view:** `vw_gold_confirmation`
**FastAPI route:** Not implemented — blocked pending DDL confirmation
**Status: BLOCKED** — no `DESCRIBE TABLE` output available for `vw_gold_confirmation` in connected_plant_uat. Cannot confirm column names. Do not implement until DDL is captured and confirmed.

**DDL discovery SQL (run in Databricks SQL editor as the UAT user or a workspace admin):**
```sql
-- Step 1: Confirm view exists and list all columns
DESCRIBE TABLE connected_plant_uat.csm_process_order_history.vw_gold_confirmation;

-- Step 2: Inspect sample rows for known process order
SELECT *
FROM connected_plant_uat.csm_process_order_history.vw_gold_confirmation
WHERE PROCESS_ORDER_ID = '7006965038'
LIMIT 20;

-- If PROCESS_ORDER_ID is not a column, find the linkage:
-- SELECT * FROM connected_plant_uat.csm_process_order_history.vw_gold_confirmation LIMIT 5;
```

After running the above, classify as: `view exists + columns confirmed`, `view exists + required columns missing`, `view missing`, `access denied`, `no rows for sample order`, or `unknown/not tested`.

| Required contract field | Assumed source column | Status |
|------------------------|----------------------|--------|
| `confirmationId` | unknown — may be AFBNR or derived | **blocked** |
| `operationId` | unknown | **blocked** |
| `operationText` | unknown | **blocked** |
| `confirmedYield` | unknown | **blocked** |
| `uom` | unknown | **blocked** |
| `confirmedAt` | unknown — required ISO datetime; cannot default | **blocked** |
| `isFinalConfirmation` | unknown | **blocked** |
| `scrapQuantity` | unknown | optional — blocked |
| `reworkQuantity` | unknown | optional — blocked |
| `confirmedBy` | unknown | optional — blocked |
| `setupDurationMinutes` | unknown | optional — blocked |
| `machineDurationMinutes` | unknown | optional — blocked |
| `cleaningDurationMinutes` | unknown | optional — blocked |
| `variancePercent` | unknown | optional — blocked |

**Stop condition:** Do not implement if any of `confirmationId`, `operationId`/linkage, `confirmedYield`, `confirmedAt` is absent and cannot be safely derived.

**Action required:** Run the DDL discovery SQL above. Update this table with confirmed column names before implementing.

---

## POH — `getOrderGoodsMovements` — BLOCKED

**Candidate view:** `vw_gold_adp_movement`
**FastAPI route:** Not implemented — blocked pending DDL confirmation
**Status: BLOCKED** — no `DESCRIBE TABLE` output available for `vw_gold_adp_movement` in connected_plant_uat. Cannot confirm column names. Do not implement until DDL is captured and confirmed.

**DDL discovery SQL (run in Databricks SQL editor as the UAT user or a workspace admin):**
```sql
-- Step 1: Confirm view exists and list all columns
DESCRIBE TABLE connected_plant_uat.csm_process_order_history.vw_gold_adp_movement;

-- Step 2: Inspect sample rows for known process order
SELECT *
FROM connected_plant_uat.csm_process_order_history.vw_gold_adp_movement
WHERE PROCESS_ORDER_ID = '7006965038'
LIMIT 50;

-- If PROCESS_ORDER_ID is not a column, find the linkage:
-- SELECT * FROM connected_plant_uat.csm_process_order_history.vw_gold_adp_movement LIMIT 5;
```

After running the above, classify as: `view exists + columns confirmed`, `view exists + required columns missing`, `view missing`, `access denied`, `no rows for sample order`, or `unknown/not tested`.

| Required contract field | Assumed source column | Status |
|------------------------|----------------------|--------|
| `movementId` | unknown — may be MBLNR/ZEILE or derived | **blocked** |
| `movementType` | unknown — SAP BWART code (101, 261, etc.) | **blocked** |
| `direction` | derived from movementType | **blocked** |
| `materialId` | unknown — MATNR; must preserve leading zeros | **blocked** |
| `materialDescription` | unknown | **blocked** |
| `quantity` | unknown | **blocked** |
| `uom` | unknown | **blocked** |
| `postedAt` | unknown — required ISO datetime; cannot default | **blocked** |
| `batchId` | unknown — CHARG | optional — blocked |
| `postedBy` | unknown — USNAM | optional — blocked |
| `referenceDocument` | unknown — AUFNR or source doc | optional — blocked |
| `storageLocation` | unknown — LGORT | optional — blocked |

**Planned movement category mapping (implement only if movementType column confirmed):**

| SAP BWART | Meaning | V2 direction |
|-----------|---------|-------------|
| 101 | Goods receipt from production | `output` |
| 261 | Goods issue to order | `input` |
| 102 | Reversal of 101 | `output` (reversal) |
| 262 | Reversal of 261 | `input` (reversal) |
| others | Unknown | document only — do not guess |

**Stop condition:** Do not implement if `PROCESS_ORDER_ID` linkage is absent, or if `materialId`, `movementType`, `quantity`, or `postedAt` cannot be confirmed.

**Action required:** Run the DDL discovery SQL above. Update this table with confirmed column names before implementing.

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
