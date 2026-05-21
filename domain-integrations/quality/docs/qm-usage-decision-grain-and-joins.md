# QM Usage-Decision Source — Grain and Join Assessment

**Status:** SQL templates ready — not run; all grain and join cells are unverified
**Created:** 2026-05-21
**Related:** `qm-usage-decision-source-verification.md`, `quality-databricks-source-verification.md`

This document defines the grain hypotheses and join assessment for the QM usage-decision source. No grain or join claim is made here — every cell must be populated from live Databricks evidence before any domain uses this source.

---

## 1. Grain Hypotheses

The grain of the usage-decision source is unknown. The following hypotheses must be tested in the order listed, using the SQL templates in §2.

| Hypothesis | Description | Status | Notes |
|---|---|---|---|
| One row per inspection lot | Each inspection lot has exactly one usage-decision row (current-state) | not verified | Most likely for a SAP QM current-state view |
| One row per inspection lot + operation | Multiple UD rows per lot, one per operation | not verified | Possible if lot has multiple operations |
| One row per material + batch + plant | UD source is batch-centric, not lot-centric | not verified | Possible for batch-quality-lot views |
| One row per process order + batch | UD linked through process order, not inspection lot | not verified | Less likely for standalone UD view |
| Historical rows per decision/version | Multiple rows per lot, one per decision version/timestamp | not verified | Possible if source is audit-style |
| Unknown | Grain is not determinable from available evidence | assumed until run | Default until evidence populated |

---

## 2. Grain Verification SQL Templates

Replace `<verified_usage_decision_object>` and all column names with the actual names found in `DESCRIBE` output. Do not run these with assumed column names.

```sql
-- Total row count
SELECT COUNT(*) AS row_count
FROM connected_plant_uat.gold.<verified_usage_decision_object>;

-- H1: one row per inspection lot
SELECT
  inspection_lot_id,
  COUNT(*) AS rows
FROM connected_plant_uat.gold.<verified_usage_decision_object>
GROUP BY inspection_lot_id
HAVING COUNT(*) > 1
ORDER BY rows DESC
LIMIT 50;

-- H3: one row per material + batch + plant
SELECT
  material_id,
  batch_id,
  plant_id,
  COUNT(*) AS rows
FROM connected_plant_uat.gold.<verified_usage_decision_object>
GROUP BY material_id, batch_id, plant_id
HAVING COUNT(*) > 1
ORDER BY rows DESC
LIMIT 50;

-- H3 extended: one row per material + batch + plant + inspection lot
SELECT
  material_id,
  batch_id,
  plant_id,
  inspection_lot_id,
  COUNT(*) AS rows
FROM connected_plant_uat.gold.<verified_usage_decision_object>
GROUP BY material_id, batch_id, plant_id, inspection_lot_id
HAVING COUNT(*) > 1
ORDER BY rows DESC
LIMIT 50;

-- H5: historical — multiple rows per lot
SELECT
  inspection_lot_id,
  COUNT(*) AS decision_rows,
  MIN(usage_decision_created_date) AS first_decision,
  MAX(usage_decision_created_date) AS last_decision
FROM connected_plant_uat.gold.<verified_usage_decision_object>
GROUP BY inspection_lot_id
HAVING COUNT(*) > 1
ORDER BY decision_rows DESC
LIMIT 50;

-- Null key frequency (understand completeness)
SELECT
  COUNT(*) AS total_rows,
  COUNT(inspection_lot_id) AS rows_with_lot_id,
  COUNT(material_id) AS rows_with_material_id,
  COUNT(batch_id) AS rows_with_batch_id,
  COUNT(plant_id) AS rows_with_plant_id
FROM connected_plant_uat.gold.<verified_usage_decision_object>;
```

---

## 3. Plant Handling

SAP QM inspection lots are plant-scoped. The following plant behaviours must be checked:

| Question | Expected | Actual | Verified? |
|---|---|---|---|
| Does the source contain a `PLANT_ID` or equivalent column? | Yes | TBD | not run |
| Is plant required for a unique key (material + batch + plant = one row)? | Likely yes | TBD | not run |
| Does the source return rows across multiple plants for the same material/batch? | Possible | TBD | not run |
| Is plant preserved in leading-zero format (e.g. `C061`, `P132`)? | Yes | TBD | not run |

If no plant column exists, the join to traceability (which is plant-aware) may produce fan-out or ambiguity. Document the actual result.

---

## 4. Leading-Zero Preservation

SAP IDs commonly contain leading zeros in storage (`000000000020052009`, `0008602411`). The Databricks gold views may or may not strip them.

| ID Type | V1 Format | Traceability UAT Candidate | Verified Preservation? |
|---|---|---|---|
| Material ID | 18-char with leading zeros | `000000000020052009` | not run |
| Batch ID | 10-char with leading zeros | `0008602411` | not run |
| Inspection Lot ID | Typically 10-12 chars | TBD | not run |
| Plant ID | 4-char alphanumeric | `C061` | not run |

Before any join is wired, verify that the ID format in the usage-decision source matches the format used in `gold_batch_stock_v` (which confirmed `MATERIAL_ID` + `BATCH_ID` as the join keys for the batch header query).

---

## 5. Join Assessment Table

All joins below are unverified. "Verified?" must be populated from Databricks evidence before any domain uses this source.

| Target Domain | Required Join | Candidate Columns (from V1) | Verified? | Risk | Recommendation |
|---|---|---|---|---|---|
| Quality Evidence | inspection lot / material / batch / plant | `INSPECTION_LOT_ID`, `MATERIAL_ID`, `BATCH_ID`, `PLANT_ID` | not run | Fan-out if grain > 1 row per lot | Verify grain first; join on `INSPECTION_LOT_ID` if available |
| Traceability Batch Header | material + batch + plant | `MATERIAL_ID`, `BATCH_ID`, `PLANT_ID` | not run | Multi-plant ambiguity if plant absent | Require plant filter; LEFT JOIN preserving header rows |
| Traceability Supplier Exposure | supplier receipt lineage to batch quality evidence | UD not a direct supplier join; requires batch → lot → UD path | not run | Cannot derive supplier risk from UD alone | Supplier risk rules must be separately governed; UD is evidence only |
| Traceability Production History | process order / material / batch / plant | `MATERIAL_ID`, `BATCH_ID`, or `PROCESS_ORDER_ID` | not run | `quality_status` from production history is not UD; must remain distinct | Show UD evidence separately; do not replace `quality_status` with UD code |
| POH | process order / inspection lot | `PROCESS_ORDER_ID` or `INSPECTION_LOT_ID` | not run | PO–lot join path exists in V1 (via `vw_gold_inspection_lot`) | Verify PO→lot→UD path before wiring |
| SPC | MIC/result/spec context — not release status | Not applicable — UD is not SPC control status | n/a | Risk of conflation: UD ≠ control status | Do not use UD in SPC context |

---

## 6. Join Verification SQL Templates

```sql
-- Verify join to inspection lot source (run only if inspection lot object is verified)
SELECT
  ud.inspection_lot_id,
  ud.usage_decision_code,
  il.MATERIAL_ID AS lot_material,
  il.BATCH_ID AS lot_batch,
  il.PLANT_ID AS lot_plant,
  il.PROCESS_ORDER_ID AS lot_po
FROM connected_plant_uat.gold.<verified_usage_decision_object> ud
LEFT JOIN connected_plant_uat.gold.<verified_inspection_lot_object> il
  ON il.INSPECTION_LOT_ID = ud.inspection_lot_id
WHERE ud.inspection_lot_id IS NOT NULL
LIMIT 50;

-- Verify join to batch header (run only if material_id + batch_id are confirmed as join keys)
SELECT
  ud.material_id,
  ud.batch_id,
  ud.plant_id,
  ud.inspection_lot_id,
  ud.usage_decision_code,
  s.PLANT_ID AS stock_plant,
  s.UNRESTRICTED,
  s.BLOCKED,
  s.QUALITY_INSPECTION
FROM connected_plant_uat.gold.<verified_usage_decision_object> ud
LEFT JOIN connected_plant_uat.gold.gold_batch_stock_v s
  ON s.MATERIAL_ID = ud.material_id
 AND s.BATCH_ID = ud.batch_id
 AND s.PLANT_ID = ud.plant_id
WHERE ud.material_id IS NOT NULL
  AND ud.batch_id IS NOT NULL
LIMIT 50;

-- Verify join for UAT traceability candidate
-- Reference candidate: MATERIAL_ID=000000000020052009, BATCH_ID=0008602411, PLANT_ID=C061
SELECT *
FROM connected_plant_uat.gold.<verified_usage_decision_object>
WHERE material_id IN ('000000000020052009', '20052009')
  AND batch_id IN ('0008602411', '8602411')
LIMIT 25;

-- Check for POH join path (process order → inspection lot → usage decision)
-- Run only if process_order_id column exists on usage decision or inspection lot object
SELECT
  ud.*,
  il.PROCESS_ORDER_ID
FROM connected_plant_uat.gold.<verified_usage_decision_object> ud
JOIN connected_plant_uat.gold.<verified_inspection_lot_object> il
  ON il.INSPECTION_LOT_ID = ud.inspection_lot_id
WHERE il.PROCESS_ORDER_ID = '7006965038'  -- Golden POH candidate
LIMIT 25;
```

---

## 7. Fan-Out Risk Assessment

A join produces fan-out when the usage-decision source has more than one row per inspection lot or per material/batch combination. Fan-out corrupts aggregate queries (sum of quantities, etc.) and must be resolved before wiring any adapter.

| Risk | Description | How to Detect | Mitigation |
|---|---|---|---|
| Multiple UD rows per inspection lot (historical) | Source stores one row per decision version | Grain check H5 above | Use latest row only (ORDER BY decision date DESC, LIMIT 1 per lot) |
| Multiple inspection lots per batch | A batch may have more than one inspection lot | Join and count distinct lot IDs per batch | Decide which lot is authoritative; or surface all |
| Multiple operations per lot | UD is per-operation, not per-lot | Grain check H2 above | Aggregate or select specific operation |
| Null inspection lot ID | UD row exists but cannot be joined to a lot | Null key check above | Exclude null-lot rows or handle separately |

---

## 8. Summary Table (to be populated)

| Item | Verified? | Result | Date |
|---|---|---|---|
| Object name confirmed | not run | TBD | TBD |
| Object type (table/view/other) | not run | TBD | TBD |
| Column names captured | not run | TBD | TBD |
| Grain: one row per inspection lot | not run | TBD | TBD |
| Grain: historical or current-state | not run | TBD | TBD |
| Plant column present | not run | TBD | TBD |
| Join to material/batch confirmed | not run | TBD | TBD |
| Join to inspection lot confirmed | not run | TBD | TBD |
| Join to process order confirmed | not run | TBD | TBD |
| Leading-zero format documented | not run | TBD | TBD |
| Fan-out risk assessed | not run | TBD | TBD |
