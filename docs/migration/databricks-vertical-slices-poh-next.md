# POH Next Databricks Vertical Slices — Candidate Analysis

**Date:** 2026-05-17  
**Foundation:** POH order header and CQ lab plants browser-verified (2026-05-17). End-to-end Databricks path proven.  
**Reference:** `docs/audit/adapter-source-status-matrix.md`, `docs/audit/native-databricks-column-verification-checklist.md`

---

## Context

The native Databricks read path is proven end-to-end. This document analyses the next POH candidates for native migration and records the implement/defer decision for each.

Sample process order for testing: **7006965038**

---

## 1. `getOrderOperations` — IMPLEMENTED

| Field | Value |
|---|---|
| V2 panel | Process Order Review — Operations / Phases tab |
| Mock method | `ProcessOrderReviewAdapter.getOrderOperations` |
| Contract | `ProcessOrderOperation[]` (`packages/data-contracts/src/schemas/process-order-review.ts`) |
| Source view | `vw_gold_process_order_phase` |
| QuerySpec | `poh.get_order_operations` |
| FastAPI route | `GET /api/por/order-operations?process_order_id=...` |
| Frontend wiring | `ProcessOrderReviewLegacyApiAdapter.getOrderOperations` |

**Source columns confirmed from DDL (2026-05-17):**

| Column | Maps to | Status |
|--------|---------|--------|
| `PROCESS_ORDER_PHASE_ID` | `operationId` | confirmed-ddl |
| `PHASE_ID` | `operationNumber` | confirmed-ddl |
| `PHASE_DESCRIPTION` | `operationText` | confirmed-ddl |
| `PHASE_TEXT` | `operationDetail` (not in contract) | confirmed-ddl |
| `OPERATION_QUANTITY` | planned qty (not in contract) | confirmed-ddl |
| `OPERATION_QUANTITY_UOM` | uom (not in contract) | confirmed-ddl |
| `SORT_NUMBER` | order key | confirmed-ddl |
| `START_USER` | infers status/confirmationStatus | confirmed-ddl |
| `END_USER` | infers confirmed/status | confirmed-ddl |

**Contract fields not in view (returned as empty/zero defaults):**
- `workCentre` → `""`
- `plannedStart` → `""`
- `plannedFinish` → `""`
- `plannedDurationMinutes` → `0`
- `hasException` → `false`

**Risk:** Low. View DDL confirmed. Status inference from START_USER/END_USER is conservative and documented. Known gaps documented rather than faked.

**User value:** High — Operations tab shows no live data without this slice.

**Decision: IMPLEMENTED.** Browser verification still required — see `docs/deployment/poh-native-slices-browser-verification.md`.

---

## 2. `getOrderConfirmations` — DEFERRED (BLOCKED)

| Field | Value |
|---|---|
| V2 panel | Process Order Review — Confirmations tab |
| Mock method | `ProcessOrderReviewAdapter.getOrderConfirmations` |
| Contract | `ProcessOrderConfirmation[]` |
| Candidate view | `vw_gold_confirmation` |
| FastAPI route | Not implemented |

**Blocker:** No `DESCRIBE TABLE` output available for `vw_gold_confirmation`. Column names unknown. Without DDL confirmation, implementation risks silent data mapping errors.

**Required fields to verify before implementing:**
- `confirmationId` — source column unknown
- `operationId` / `operationNumber` — likely FK to `vw_gold_process_order_phase`
- `confirmedYield` — source column unknown
- `scrapQuantity` — source column unknown
- `reworkQuantity` — source column unknown
- `confirmationDateTime` — source column unknown
- `postedBy` — source column unknown
- `finalConfirmationFlag` — source column unknown
- `varianceVsPlan` — source column unknown

**Action required:** Run `DESCRIBE TABLE connected_plant_uat.csm_process_order_history.vw_gold_confirmation` in the Databricks workspace. Update `docs/audit/native-databricks-column-verification-checklist.md` with confirmed column names, then implement.

**Decision: DEFERRED — blocked on DDL confirmation.**

---

## 3. `getOrderGoodsMovements` — DEFERRED (BLOCKED)

| Field | Value |
|---|---|
| V2 panel | Process Order Review — Goods Movements tab |
| Mock method | `ProcessOrderReviewAdapter.getOrderGoodsMovements` |
| Contract | `ProcessOrderGoodsMovement[]` |
| Candidate view | `vw_gold_adp_movement` |
| FastAPI route | Not implemented |

**Blocker:** No `DESCRIBE TABLE` output available for `vw_gold_adp_movement`. Column names unknown.

**Required fields to verify before implementing:**
- `movementType` — SAP BWART code — source column unknown
- `materialId` — source column unknown
- `materialDescription` — source column unknown
- `batchId` — source column unknown
- `quantity` — source column unknown
- `unit` — source column unknown
- `postingDate` — source column unknown
- `debitCreditIndicator` — source column unknown (optional)
- `processOrderId` — FK to order — source column unknown
- `storageLocation` — source column unknown (optional)
- `movementCategory` — business logic (input/output/receipt/issue) — derivation unknown

**Action required:** Run `DESCRIBE TABLE connected_plant_uat.csm_process_order_history.vw_gold_adp_movement` in the Databricks workspace. Note that `movementCategory` may require a mapping from BWART codes (261 = goods issue, 101 = goods receipt) — confirm the view's BWART values before implementing the category map.

**Decision: DEFERRED — blocked on DDL confirmation.**

---

## 4. `getExecutionTimeline` — DEFERRED

| Field | Value |
|---|---|
| V2 panel | Process Order Review — Execution Timeline panel |
| Candidate source | Derivable from `vw_gold_process_order_phase` (same as operations) |
| Decision | Deferred — timeline would be derived from start/end data not present in the phase view |

No date columns exist in `vw_gold_process_order_phase`. Without `plannedStart`/`plannedFinish` from the operations, a timeline cannot be constructed. Deferred until a richer operations view is confirmed.

---

## Implementation Order

1. ~~`getOrderOperations`~~ — **DONE** (2026-05-17)
2. `getOrderConfirmations` — blocked; implement after DDL confirmed
3. `getOrderGoodsMovements` — blocked; implement after DDL confirmed
4. `getExecutionTimeline` — deferred; blocked on date columns

---

## No SPN/PAT Fallback

All implemented and future slices execute as end-user OAuth. No service-principal or PAT fallback paths exist or will be added. If OAuth is unavailable, the route returns 401.
