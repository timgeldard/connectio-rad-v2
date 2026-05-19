# Databricks Column Verification Queries — gold_batch_summary_v

**Status: BLOCKED — requires live Databricks UAT environment**

This document provides the exact SQL queries that must be run during UAT to verify
column names in `gold_batch_summary_v`. All column names in that view are currently
marked `-- TODO: verify column name` in
`apps/api/adapters/trace2/trace2_databricks_adapter.py`.

Until these queries are executed and results documented, do **not** remove the TODO
markers or assume the column names are correct.

---

## Background

`gold_batch_summary_v` is joined by `get_batch_header_summary_spec` to provide
batch-level metadata: plant ID, manufacture date, expiry date, batch status, UOM,
and process order ID. These are critical fields for a batch investigation — an
incorrect column name silently produces null values that may be mistaken for
"no data" rather than a configuration error.

The join key itself (`b.material_id = s.material_id AND b.batch_id = s.batch_id`)
is also unverified.

---

## Queries to run in UAT

Replace `<catalog>` and `<schema>` with the actual values from your Databricks
environment (typically `TRACE_CATALOG` and `TRACE_SCHEMA` from app configuration).

### 1. Describe the view structure

```sql
DESCRIBE TABLE `<catalog>`.`<schema>`.gold_batch_summary_v
```

**What to record:**
- Actual column names for: plant ID, manufacture date, expiry date, batch status,
  UOM (unit of measure), process order ID, material ID, batch ID.
- Data types for date columns (`manufacture_date`, `expiry_date`) — confirm whether
  they are DATE, TIMESTAMP, or STRING. The Python mapper reads them as strings;
  if they are DATE type, confirm format.
- Whether the join columns (`material_id`, `batch_id`) exist with those exact names.

### 2. Confirm join key with a known batch

```sql
SELECT
    b.material_id,
    b.batch_id,
    b.plant_id,
    b.manufacture_date,
    b.expiry_date,
    b.batch_status,
    b.uom,
    b.process_order_id
FROM `<catalog>`.`<schema>`.gold_batch_summary_v b
WHERE b.material_id = '<known_material_id>'
  AND b.batch_id = '<known_batch_id>'
LIMIT 1
```

Use a known valid batch (see `domain-integrations/traceability/docs/golden-test-batches.md`).

**What to record:**
- Whether the query runs without column-not-found errors.
- Whether the returned values match SAP source data for the known batch.
- Exact column names as returned by Databricks (case may differ from assumed names).

### 3. Confirm join between gold_batch_stock_v and gold_batch_summary_v

```sql
SELECT
    s.material_id,
    s.batch_id,
    s.total_stock,
    b.plant_id,
    b.batch_status,
    b.uom
FROM `<catalog>`.`<schema>`.gold_batch_stock_v s
JOIN `<catalog>`.`<schema>`.gold_batch_summary_v b
    ON s.material_id = b.material_id AND s.batch_id = b.batch_id
WHERE s.material_id = '<known_material_id>'
  AND s.batch_id = '<known_batch_id>'
LIMIT 1
```

**What to record:**
- Whether the join succeeds.
- Whether `plant_id`, `batch_status`, `uom` return expected values.
- Whether the join is 1-to-1 or produces fan-out (multiple rows per batch).

### 4. Confirm language filter for gold_material join

```sql
SELECT DISTINCT language_id
FROM `<catalog>`.`<schema>`.gold_material
WHERE material_id = '<known_material_id>'
LIMIT 10
```

**What to record:**
- Whether `language_id = 'EN'` filter is valid and returns exactly one row.
- If not `'EN'`, record the correct filter value and update
  `get_batch_header_summary_spec` accordingly.

---

## After verification

Once the column names are confirmed:

1. Update `get_batch_header_summary_spec` in
   `apps/api/adapters/trace2/trace2_databricks_adapter.py`:
   - Replace `-- TODO: verify column name` with `-- verified: <date> <env>`
   - Correct any column name that differs from the assumed name.
   - Correct the join key if it differs.

2. Update `test_sql_contains_todo_markers` in
   `apps/api/tests/adapters/trace2/test_trace2_databricks_adapter.py`:
   - If all TODOs are resolved, rename the test to
     `test_sql_has_no_unverified_column_assumptions` and assert the opposite.

3. Update this document: record verification date, environment, and results.

---

## Current unverified assumptions

| Column (assumed)  | View                  | Status          |
|-------------------|-----------------------|-----------------|
| `plant_id`        | gold_batch_summary_v  | UNVERIFIED      |
| `manufacture_date`| gold_batch_summary_v  | UNVERIFIED      |
| `expiry_date`     | gold_batch_summary_v  | UNVERIFIED      |
| `batch_status`    | gold_batch_summary_v  | UNVERIFIED      |
| `uom`             | gold_batch_summary_v  | UNVERIFIED      |
| `process_order_id`| gold_batch_summary_v  | UNVERIFIED      |
| join key          | gold_batch_summary_v  | UNVERIFIED      |
| `language_id='EN'`| gold_material         | UNVERIFIED      |

All other columns used in `get_batch_header_summary_spec` are confirmed from V1
source inspection (`docs/migration/trace2-functional-parity-audit.md §3`).
