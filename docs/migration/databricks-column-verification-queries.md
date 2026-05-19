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

## Known reference candidate batch

Use the following batch for all queries below unless you have a specific reason to use another.

| Field | Value |
|---|---|
| `material_id` | `000000000020052009` |
| `batch_id` | `0008602411` |
| `plant_id` | `C061` |

This is Entry 2 in `domain-integrations/traceability/docs/golden-test-batches.md`. Confirm
the batch exists in your target environment before running. Do not substitute mock values.

---

## Queries to run in UAT

Replace `<catalog>` and `<schema>` with the actual values from your Databricks
environment (typically `TRACE_CATALOG` and `TRACE_SCHEMA` from app configuration).
Use `000000000020052009` / `0008602411` as the default known batch unless testing a
different one.

### 1. List all column names (SHOW COLUMNS)

```sql
SHOW COLUMNS IN `<catalog>`.`<schema>`.gold_batch_summary_v
```

**What to record:**
- Complete list of columns returned. Paste the output into the evidence table below.
- Use this output to verify assumed names before running any further queries.

### 2. Describe column types (DESCRIBE TABLE)

```sql
DESCRIBE TABLE `<catalog>`.`<schema>`.gold_batch_summary_v
```

**What to record:**
- Data types for `manufacture_date` and `expiry_date` — confirm whether DATE, TIMESTAMP,
  or STRING. The Python mapper reads them as strings; if DATE/TIMESTAMP, confirm
  the format returned when cast to string.
- Whether `material_id` and `batch_id` are STRING or another type (affects WHERE clause).

### 3. Sample rows for the reference candidate batch

```sql
SELECT *
FROM `<catalog>`.`<schema>`.gold_batch_summary_v
WHERE material_id = '000000000020052009'
  AND batch_id    = '0008602411'
LIMIT 10
```

**What to record:**
- Whether any rows are returned. If zero: confirm material_id / batch_id format
  (leading zeros, case sensitivity).
- Exact column names from the result header.
- Sample values for all columns — used to verify business field semantics (e.g. batch_status
  values, date format, process_order_id format).

### 4. Row-count check for the reference candidate batch

```sql
SELECT COUNT(*) AS row_count
FROM `<catalog>`.`<schema>`.gold_batch_summary_v
WHERE material_id = '000000000020052009'
  AND batch_id    = '0008602411'
```

**What to record:**
- `row_count = 0`: batch not in view — check identifier format.
- `row_count = 1`: expected. The adapter JOIN is safe.
- `row_count > 1`: fan-out — investigate (plant variants, date ranges). The adapter's
  `LIMIT :max_rows` will return only the first row.

### 5. Null-rate check for required batch header fields

```sql
SELECT
    COUNT(*)                                                  AS total_rows,
    COUNT(plant_id)                                           AS plant_id_non_null,
    COUNT(manufacture_date)                                   AS manufacture_date_non_null,
    COUNT(expiry_date)                                        AS expiry_date_non_null,
    COUNT(batch_status)                                       AS batch_status_non_null,
    COUNT(uom)                                                AS uom_non_null,
    COUNT(process_order_id)                                   AS process_order_id_non_null,
    ROUND(COUNT(plant_id)         / COUNT(*) * 100, 1)        AS plant_id_pct,
    ROUND(COUNT(manufacture_date) / COUNT(*) * 100, 1)        AS manufacture_date_pct,
    ROUND(COUNT(expiry_date)      / COUNT(*) * 100, 1)        AS expiry_date_pct,
    ROUND(COUNT(batch_status)     / COUNT(*) * 100, 1)        AS batch_status_pct,
    ROUND(COUNT(uom)              / COUNT(*) * 100, 1)        AS uom_pct,
    ROUND(COUNT(process_order_id) / COUNT(*) * 100, 1)        AS process_order_id_pct
FROM `<catalog>`.`<schema>`.gold_batch_summary_v
LIMIT 1
```

> **Note:** Run this only after confirming column names in queries 1–2. Replace column
> names above if they differ from the assumed names.

**What to record:**
- Null rates above 20% for `plant_id`, `manufacture_date`, `expiry_date`, or `batch_status`
  are a risk signal — the adapter may return nulls for many batches, which the UI will
  show as "unavailable" rather than a configuration error.
- `process_order_id` high null rate is expected (not all batches have a process order).

### 6. Confirm join between gold_batch_stock_v and gold_batch_summary_v

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
WHERE s.material_id = '000000000020052009'
  AND s.batch_id    = '0008602411'
LIMIT 5
```

**What to record:**
- Whether the join succeeds without column errors.
- Whether `plant_id`, `batch_status`, `uom` return expected values.
- Whether the result is 1 row (expected) or multiple rows (fan-out risk).

### 7. Confirm language filter for gold_material join

```sql
SELECT DISTINCT language_id
FROM `<catalog>`.`<schema>`.gold_material
WHERE material_id = '000000000020052009'
ORDER BY language_id
LIMIT 20
```

**What to record:**
- Whether `'EN'` appears in the result. If not, identify the correct language code for
  English material descriptions and update `get_batch_header_summary_spec`.
- If multiple English-equivalent codes exist (e.g. `'EN'` and `'E'`), record all.

### 8. Distinct batch_status values (enum verification)

```sql
SELECT DISTINCT batch_status, COUNT(*) AS row_count
FROM `<catalog>`.`<schema>`.gold_batch_summary_v
GROUP BY batch_status
ORDER BY row_count DESC
LIMIT 20
```

**What to record:**
- Actual `batch_status` values in the live data.
- Compare against `BatchHeaderSummarySchema.batchStatus` enum:
  `'active' | 'archived' | 'blocked' | 'deleted'`.
- Flag any live values that are not in the schema enum — the adapter will need to map or
  ignore them to avoid Zod validation failures.

---

## Evidence capture

After running the queries above, fill in this table and commit it to this document or paste
into the UAT validation ledger (`domain-integrations/traceability/docs/uat-validation-ledger.md`).

| Field | Value |
|-------|-------|
| **Tester identity** | _(alias, initials, or ticket reference — no full name or email)_ |
| **Date / time (UTC)** | _(ISO timestamp)_ |
| **Databricks workspace URL** | _(e.g. `https://<workspace>.azuredatabricks.net`)_ |
| **Catalog** | _(value of TRACE_CATALOG env var)_ |
| **Schema** | _(value of TRACE_SCHEMA env var, typically `gold`)_ |
| **App version / commit** | _(git SHA from deployed app)_ |
| **Query notebook / file** | _(link or path to notebook where queries were run)_ |
| **`gold_batch_summary_v` confirmed columns** | _(list: actual column names as returned by SHOW COLUMNS)_ |
| **`plant_id` column — confirmed name** | _(confirmed / different: `<actual_name>`)_ |
| **`manufacture_date` column — confirmed name** | _(confirmed / different)_ |
| **`expiry_date` column — confirmed name** | _(confirmed / different)_ |
| **`batch_status` column — confirmed name** | _(confirmed / different)_ |
| **`batch_status` live enum values** | _(list all distinct values found)_ |
| **`uom` column — confirmed name** | _(confirmed / different)_ |
| **`process_order_id` column — confirmed name** | _(confirmed / different)_ |
| **Join key (material_id + batch_id) — confirmed** | _(yes / no / different)_ |
| **Row count for reference batch** | _(integer — expected: 1)_ |
| **language_id for EN descriptions** | _(confirmed `'EN'` / different: `<value>`)_ |
| **Null rates acceptable** | _(yes / no — see query 5 results)_ |
| **Unresolved fields** | _(list any column names still uncertain after this run)_ |
| **Next action** | _(e.g. "Update TODOs in adapter", "Raise issue for <field>")_ |

---

## After verification

Once the column names are confirmed:

1. Update `get_batch_header_summary_spec` in
   `apps/api/adapters/trace2/trace2_databricks_adapter.py`:
   - Replace `-- TODO: verify column name` with `-- verified: <date> <env>`
   - Correct any column name that differs from the assumed name.
   - Correct the join key if it differs.
   - Correct `language_id` filter if the confirmed value differs from `'EN'`.

2. Update `test_sql_contains_todo_markers` in
   `apps/api/tests/adapters/trace2/test_trace2_databricks_adapter.py`:
   - If all TODOs are resolved, rename the test to
     `test_sql_has_no_unverified_column_assumptions` and assert the opposite.

3. Update the evidence capture table above with the confirmed values.

4. Update production readiness row 1.7 in
   `domain-integrations/traceability/docs/production-readiness-checklist.md`.

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
