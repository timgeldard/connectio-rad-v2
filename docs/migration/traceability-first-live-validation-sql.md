# Traceability — First Live Validation SQL Pack

**Status: AWAITING EXECUTION — no live validation performed as of 2026-05-19**  
**Candidate batch:** `material_id = '000000000020052009'`, `batch_id = '0008602411'`, `plant_id = 'C061'`  
**Complements:** `docs/migration/databricks-column-verification-queries.md` (gold_batch_summary_v detail)

> **Before running:** Replace `<catalog>` and `<schema>` with the values from your Databricks
> environment (`TRACE_CATALOG` and `TRACE_SCHEMA` from app config). Run sections independently —
> do not assume a section succeeds until you observe the output. Do not remove TODO markers
> in adapter code until column names are confirmed here.

---

## Candidate batch

```sql
-- Reference candidate A (Entry 2 in golden-test-batches.md)
-- material_id = '000000000020052009'
-- batch_id    = '0008602411'
-- plant_id    = 'C061'
--
-- Confirm this batch exists in the target environment before relying on it.
-- If it returns no rows, identify a valid C061 batch from gold_batch_stock_v.
```

---

## Section 1 — Environment confirmation

Run these first to confirm you are connected to the correct workspace and schema.

```sql
-- 1a. Current user (Databricks SQL)
SELECT current_user() AS current_user;

-- 1b. Current timestamp
SELECT current_timestamp() AS query_run_at;

-- 1c. List available schemas in the catalog (confirm which schema contains gold views)
SHOW SCHEMAS IN `<catalog>`;

-- 1d. List gold views available in the schema
SHOW TABLES IN `<catalog>`.`<schema>`;
```

**What to record:**
- Current user matches the expected OAuth identity (not a service principal).
- The target schema is present and gold views are listed.

---

## Section 2 — gold_batch_summary_v verification

> **See `docs/migration/databricks-column-verification-queries.md` for the full 8-query
> verification procedure for this view.** The queries here are a summary. Run the full
> procedure if this is the first verification session.

```sql
-- 2a. Column names (SHOW COLUMNS)
SHOW COLUMNS IN `<catalog>`.`<schema>`.gold_batch_summary_v;

-- 2b. Column types (DESCRIBE TABLE)
DESCRIBE TABLE `<catalog>`.`<schema>`.gold_batch_summary_v;

-- 2c. Sample row for candidate batch
SELECT *
FROM `<catalog>`.`<schema>`.gold_batch_summary_v
WHERE material_id = '000000000020052009'
  AND batch_id    = '0008602411'
LIMIT 10;

-- 2d. Row count for candidate batch (expected: 1; >1 = fan-out risk)
SELECT COUNT(*) AS row_count
FROM `<catalog>`.`<schema>`.gold_batch_summary_v
WHERE material_id = '000000000020052009'
  AND batch_id    = '0008602411';

-- 2e. Distinct batch_status values (verify against schema enum)
-- Schema enum: 'active' | 'archived' | 'blocked' | 'deleted'
SELECT DISTINCT batch_status, COUNT(*) AS cnt
FROM `<catalog>`.`<schema>`.gold_batch_summary_v
GROUP BY batch_status
ORDER BY cnt DESC
LIMIT 20;
```

**Unverified column assumptions (from adapter code):**
`plant_id`, `manufacture_date`, `expiry_date`, `batch_status`, `uom`, `process_order_id`, join key.
See `databricks-column-verification-queries.md` §8 for the full evidence capture table.

---

## Section 3 — gold_batch_stock_v candidate row

```sql
-- 3a. Column names
SHOW COLUMNS IN `<catalog>`.`<schema>`.gold_batch_stock_v;

-- 3b. Candidate batch stock row
SELECT
    material_id,
    batch_id,
    plant_id,
    unrestricted,
    blocked,
    quality_inspection,
    restricted,          -- NOTE: column name unverified; may differ
    transit,             -- NOTE: column name unverified; may differ
    total_stock
FROM `<catalog>`.`<schema>`.gold_batch_stock_v
WHERE material_id = '000000000020052009'
  AND batch_id    = '0008602411'
LIMIT 5;

-- 3c. Row count (expected: 1 per plant; may be multiple if data is multi-plant)
SELECT COUNT(*) AS row_count
FROM `<catalog>`.`<schema>`.gold_batch_stock_v
WHERE material_id = '000000000020052009'
  AND batch_id    = '0008602411';
```

**What to record:**
- Whether `restricted` column exists (the V2 schema uses it; V1 mapped it differently).
- Whether `transit` column exists.
- Actual column names for any that differ from assumed names above.
- `total_stock` value and breakdown across stock type buckets.

---

## Section 4 — Stock + summary join check

```sql
-- Confirm the join between gold_batch_stock_v and gold_batch_summary_v works
-- and does not fan-out.
SELECT
    s.material_id,
    s.batch_id,
    s.total_stock,
    s.unrestricted,
    s.quality_inspection,
    b.plant_id,
    b.batch_status,
    b.uom,
    b.manufacture_date,
    b.expiry_date
FROM `<catalog>`.`<schema>`.gold_batch_stock_v s
JOIN `<catalog>`.`<schema>`.gold_batch_summary_v b
    ON s.material_id = b.material_id
   AND s.batch_id    = b.batch_id   -- join key unverified
WHERE s.material_id = '000000000020052009'
  AND s.batch_id    = '0008602411'
LIMIT 5;

-- Row count after join (expected: 1; >1 = fan-out in one of the views)
SELECT COUNT(*) AS join_row_count
FROM `<catalog>`.`<schema>`.gold_batch_stock_v s
JOIN `<catalog>`.`<schema>`.gold_batch_summary_v b
    ON s.material_id = b.material_id
   AND s.batch_id    = b.batch_id
WHERE s.material_id = '000000000020052009'
  AND s.batch_id    = '0008602411';
```

**What to record:**
- Whether the join succeeds without column errors.
- Row count after join (expected: 1; >1 indicates fan-out risk in one of the views).
- Values of `plant_id`, `batch_status`, `uom` — confirm against expectations.

---

## Section 5 — Material language check

```sql
-- 5a. Available language_id values for the candidate material
SELECT DISTINCT language_id, COUNT(*) AS cnt
FROM `<catalog>`.`<schema>`.gold_material
WHERE material_id = '000000000020052009'
GROUP BY language_id
ORDER BY cnt DESC
LIMIT 20;

-- 5b. Material description for the candidate batch (using assumed 'EN' language code)
-- Replace 'EN' below if the previous query shows a different English language_id.
SELECT material_id, language_id, material_description
FROM `<catalog>`.`<schema>`.gold_material
WHERE material_id = '000000000020052009'
  AND language_id = 'EN'   -- language_id value unverified
LIMIT 5;
```

**What to record:**
- Whether `'EN'` appears as a language_id value.
- Correct language_id for English descriptions if not `'EN'`.
- Material description text (for use in UAT validation ledger).

---

## Section 6 — Trace graph / lineage check

```sql
-- 6a. Confirm candidate batch anchor exists in gold_batch_lineage
SELECT COUNT(*) AS anchor_rows
FROM `<catalog>`.`<schema>`.gold_batch_lineage
WHERE (parent_material_id = '000000000020052009'
       AND parent_batch_id = '0008602411')
   OR (child_material_id  = '000000000020052009'
       AND child_batch_id  = '0008602411');

-- 6b. Distinct LINK_TYPE values for rows involving the candidate batch
-- Used to verify vendor-receipt / consumption / transfer / delivery values.
SELECT DISTINCT link_type, COUNT(*) AS cnt
FROM `<catalog>`.`<schema>`.gold_batch_lineage
WHERE (parent_material_id = '000000000020052009'
       AND parent_batch_id = '0008602411')
   OR (child_material_id  = '000000000020052009'
       AND child_batch_id  = '0008602411')
GROUP BY link_type
ORDER BY cnt DESC;

-- 6c. Sample upstream rows (candidate batch as child)
SELECT
    parent_material_id,
    parent_batch_id,
    child_material_id,
    child_batch_id,
    link_type,
    material_document_number
FROM `<catalog>`.`<schema>`.gold_batch_lineage
WHERE child_material_id = '000000000020052009'
  AND child_batch_id    = '0008602411'
LIMIT 10;

-- 6d. Sample downstream rows (candidate batch as parent)
SELECT
    parent_material_id,
    parent_batch_id,
    child_material_id,
    child_batch_id,
    link_type,
    material_document_number
FROM `<catalog>`.`<schema>`.gold_batch_lineage
WHERE parent_material_id = '000000000020052009'
  AND parent_batch_id    = '0008602411'
LIMIT 10;

-- 6e. Total upstream and downstream edge counts
SELECT
    SUM(CASE WHEN child_material_id = '000000000020052009'
              AND child_batch_id    = '0008602411' THEN 1 ELSE 0 END) AS upstream_edges,
    SUM(CASE WHEN parent_material_id = '000000000020052009'
              AND parent_batch_id    = '0008602411' THEN 1 ELSE 0 END) AS downstream_edges
FROM `<catalog>`.`<schema>`.gold_batch_lineage;
```

**What to record:**
- Whether `anchor_rows` is greater than 0 (batch exists in lineage).
- LINK_TYPE values present — compare against expected: `PRODUCTION`, `BATCH_TRANSFER`,
  `STO_TRANSFER`, `VENDOR_RECEIPT`. Record exact values found.
- Upstream and downstream edge counts.
- Whether `material_document_number` column exists and is populated.

---

## Section 7 — Mass balance check

```sql
-- 7a. Column names (SHOW COLUMNS)
SHOW COLUMNS IN `<catalog>`.`<schema>`.gold_batch_mass_balance_v;

-- 7b. Candidate batch rows
SELECT *
FROM `<catalog>`.`<schema>`.gold_batch_mass_balance_v
WHERE material_id = '000000000020052009'
  AND batch_id    = '0008602411'
LIMIT 20;

-- 7c. Row count (used to validate confidence formula in adapter)
SELECT COUNT(*) AS row_count
FROM `<catalog>`.`<schema>`.gold_batch_mass_balance_v
WHERE material_id = '000000000020052009'
  AND batch_id    = '0008602411';

-- 7d. Movement type distribution (to check unresolved movement counts)
-- NOTE: column name 'movement_type' is unverified — replace if different.
SELECT
    movement_type,              -- column name unverified
    COUNT(*) AS cnt
FROM `<catalog>`.`<schema>`.gold_batch_mass_balance_v
WHERE material_id = '000000000020052009'
  AND batch_id    = '0008602411'
GROUP BY movement_type
ORDER BY cnt DESC
LIMIT 20;
```

**What to record:**
- Whether rows are returned (batch has mass balance data).
- Column names as returned by SHOW COLUMNS.
- Row count — the adapter divides resolved/total rows to compute confidence.
- Any movement type values — compare against expected SAP movement types.

---

## Section 8 — Delivery / customer exposure prerequisites

> **Do not assume any column names for this view. Run SHOW COLUMNS first.**

```sql
-- 8a. Check if gold_batch_delivery_v exists
SHOW TABLES IN `<catalog>`.`<schema>` LIKE 'gold_batch_delivery*';

-- 8b. Column names — run only if the view exists from 8a
-- SHOW COLUMNS IN `<catalog>`.`<schema>`.gold_batch_delivery_v;

-- 8c. Candidate batch row count — run only if the view exists and columns are known
-- SELECT COUNT(*) AS row_count
-- FROM `<catalog>`.`<schema>`.gold_batch_delivery_v
-- WHERE <join_key_column> = '000000000020052009'   -- column name unverified
-- LIMIT 1;
```

**What to record:**
- Whether the view exists.
- All column names if the view is found.
- Candidate row count if the join key can be identified.
- This is a prerequisite for the customer exposure Databricks slice
  (see `docs/customer-exposure-depth-slice-plan.md`).

---

## Section 9 — QM usage decision prerequisites

> **Do not assume any column names for this view. Run SHOW COLUMNS first.**

```sql
-- 9a. Check if gold_qm_usage_decision_v exists
SHOW TABLES IN `<catalog>`.`<schema>` LIKE 'gold_qm*';

-- 9b. Column names — run only if the view exists from 9a
-- SHOW COLUMNS IN `<catalog>`.`<schema>`.gold_qm_usage_decision_v;

-- 9c. Check if gold_qm_inspection_lot_v exists
-- SHOW COLUMNS IN `<catalog>`.`<schema>`.gold_qm_inspection_lot_v;
```

**What to record:**
- Whether the QM views exist and their exact names.
- All column names if found.
- This is a prerequisite for the quality decision source implementation
  (see `docs/quality-decision-source-plan.md`).

---

## Evidence capture

After running the sections above, record results here and in
`docs/migration/databricks-column-verification-queries.md`.

| Field | Value |
|---|---|
| **Tester identity** | _(alias, initials, or ticket reference — no full name or email)_ |
| **Date / time (UTC)** | _(ISO timestamp)_ |
| **Databricks workspace URL** | _(e.g. `https://<workspace>.azuredatabricks.net`)_ |
| **Catalog** | _(value used for `<catalog>`)_ |
| **Schema** | _(value used for `<schema>`, typically `gold`)_ |
| **App version / commit** | _(git SHA of the deployed app under test)_ |
| **Current user confirmed** | _(OAuth identity, not service principal — yes / no)_ |
| **gold_batch_summary_v confirmed** | _(yes / no / partial — link to full evidence in databricks-column-verification-queries.md)_ |
| **gold_batch_stock_v confirmed** | _(yes / no — columns verified)_ |
| **restricted column exists** | _(yes / no / different name: `<actual>`)_ |
| **transit column exists** | _(yes / no / different name: `<actual>`)_ |
| **Join fan-out check** | _(row count after join: expected 1)_ |
| **material language_id for EN** | _(confirmed `'EN'` / different: `<actual>`)_ |
| **gold_batch_lineage anchor exists** | _(yes / no)_ |
| **LINK_TYPE values observed** | _(list all distinct values found)_ |
| **Upstream edge count** | _(integer)_ |
| **Downstream edge count** | _(integer)_ |
| **gold_batch_mass_balance_v row count** | _(integer)_ |
| **gold_batch_delivery_v exists** | _(yes / no)_ |
| **gold_batch_delivery_v columns** | _(list if found, or "not found")_ |
| **gold_qm_usage_decision_v exists** | _(yes / no)_ |
| **gold_qm views found** | _(list names if found)_ |
| **Unresolved issues** | _(any columns still uncertain, join failures, etc.)_ |
| **Next action** | _(e.g. "Update adapter TODOs", "Raise column name issue")_ |
