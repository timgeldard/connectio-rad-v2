# EnvMon Native Databricks Column Verification Checklist

**Date:** 2026-05-17
**Tranche:** i.txt groundwork
**Status:** ALL ITEMS UNCHECKED — no source views identified; no DDL run
**Reference:** `docs/audit/envmon-databricks-source-candidates.md`, `docs/audit/envmon-contract-inventory.md`

**Legend:**
- `confirmed-ddl` — verified via `DESCRIBE TABLE` or `SHOW COLUMNS IN` in the live workspace
- `confirmed-browser` — field value confirmed in a live API response in the browser
- `assumed` — inferred from naming convention or prior knowledge; not verified
- `missing` — expected field not found in the view DDL
- `blocked` — cannot verify until the source view is identified

Do not mark any field `confirmed-ddl` unless you have run the DDL command and seen the column name in the output. Do not infer from V1 field names or documentation alone.

---

## Prerequisites

Before running any DDL below, confirm the source view names with the domain owner or data engineering team. None of these views are confirmed to exist. Run the exploratory SQL first:

```sql
-- Step 0: Find EnvMon-relevant schemas and views
SHOW SCHEMAS IN connected_plant_uat;

-- For each schema that looks relevant (e.g. 'gold', 'lims', 'envmon', 'em'):
SHOW TABLES IN connected_plant_uat.<schema_name>;
```

---

## Group A — SAP QM Inspection Lot Candidates

These views would contain LIMS results if environmental sampling flows through SAP QM inspection lots.

### Candidate: `gold_inspection_lot`

```sql
DESCRIBE TABLE connected_plant_uat.gold.gold_inspection_lot;

SELECT * FROM connected_plant_uat.gold.gold_inspection_lot LIMIT 5;

-- Confirm plant-level filtering works:
SELECT * FROM connected_plant_uat.gold.gold_inspection_lot
WHERE PLANT_ID = 'C061'
LIMIT 20;
```

| Contract concept | Expected column name | Status |
|---|---|---|
| Lot identifier | `INSPECTION_LOT` or `INSPECTION_LOT_ID` | `[ ]` blocked |
| Plant | `PLANT_ID` | `[ ]` blocked |
| Material | `MATERIAL_ID` | `[ ]` blocked |
| Lot status | `LOT_STATUS` or `STATUS` | `[ ]` blocked |
| Sample date | `SAMPLE_DATE` or `START_DATE` | `[ ]` blocked |

### Candidate: `vw_gold_inspection_result`

```sql
DESCRIBE TABLE connected_plant_uat.gold.vw_gold_inspection_result;
-- or if in csm schema:
DESCRIBE TABLE connected_plant_uat.csm_process_order_history.vw_gold_inspection_result;

SELECT * FROM connected_plant_uat.gold.vw_gold_inspection_result LIMIT 5;
```

| Contract concept | Expected column name | Status |
|---|---|---|
| Sample / result ID | `RESULT_ID` | `[ ]` blocked |
| Inspection lot | `INSPECTION_LOT` | `[ ]` blocked |
| Characteristic / test type | `INSPECTION_CHARACTERISTIC` or `TEST_TYPE` | `[ ]` blocked |
| Result value | `RESULT_VALUE` | `[ ]` blocked |
| Result qualifier | `RESULT_QUALIFIER` (`NEG`/`POS` etc.) | `[ ]` blocked |
| Specification lower limit | `LOWER_LIMIT` | `[ ]` blocked |
| Specification upper limit | `UPPER_LIMIT` | `[ ]` blocked |
| Unit | `UOM` | `[ ]` blocked |

---

## Group B — LIMS-Native Candidates

These views would exist if LIMS exports directly to Databricks with its own schema.

### Candidate: `lims_swab_result` (or equivalent)

```sql
-- Try various schema/name combinations:
DESCRIBE TABLE connected_plant_uat.lims.lims_swab_result;
DESCRIBE TABLE connected_plant_uat.gold.lims_swab_result;
DESCRIBE TABLE connected_plant_uat.gold.em_swab_result;

SELECT * FROM connected_plant_uat.lims.lims_swab_result LIMIT 5;
```

| Contract field | Expected column | Status |
|---|---|---|
| `sampleId` | `SAMPLE_ID` or `SWAB_ID` | `[ ]` blocked |
| `locationId` | `LOCATION_ID` or `SAMPLING_POINT_ID` | `[ ]` blocked |
| `sampleDate` | `SAMPLE_DATE` or `SAMPLED_AT` | `[ ]` blocked |
| `testType` | `TEST_TYPE` or `ORGANISM` | `[ ]` blocked |
| `result` | `RESULT` (negative/positive/borderline/pending) | `[ ]` blocked |
| `resultValue` | `RESULT_VALUE` or `CFU_COUNT` | `[ ]` blocked |
| `unit` | `UOM` or `UNIT` | `[ ]` blocked |
| `specification` | `SPECIFICATION` or `LIMIT_VALUE` | `[ ]` blocked |
| `plantId` | `PLANT_ID` | `[ ]` blocked |

### Candidate: `lims_sampling_point` (or equivalent)

```sql
DESCRIBE TABLE connected_plant_uat.lims.lims_sampling_point;
DESCRIBE TABLE connected_plant_uat.gold.gold_em_location;

SELECT * FROM connected_plant_uat.lims.lims_sampling_point LIMIT 20;
```

| Contract field | Expected column | Status |
|---|---|---|
| `locationId` | `LOCATION_ID` or `POINT_ID` | `[ ]` blocked |
| `locationName` | `LOCATION_NAME` or `POINT_NAME` | `[ ]` blocked |
| `zoneId` | `ZONE_ID` or `AREA_CODE` | `[ ]` blocked |
| `hygieneZone` | `HYGIENE_ZONE` (`zone-1` .. `zone-4`) | `[ ]` blocked |
| `areaType` | `AREA_TYPE` | `[ ]` blocked |
| `plantId` | `PLANT_ID` | `[ ]` blocked |
| `x` / `y` | `X_COORD` / `Y_COORD` (for heatmap) | `[ ]` blocked |

---

## Group C — EnvMon Gold Views (if pre-built by data engineering)

### Candidate: `gold_em_result` (or equivalent)

```sql
DESCRIBE TABLE connected_plant_uat.gold.gold_em_result;

SELECT * FROM connected_plant_uat.gold.gold_em_result
WHERE PLANT_ID = 'C061'
LIMIT 20;

-- Confirm enum values:
SELECT DISTINCT RESULT FROM connected_plant_uat.gold.gold_em_result LIMIT 50;
SELECT DISTINCT HYGIENE_ZONE FROM connected_plant_uat.gold.gold_em_result LIMIT 50;
SELECT DISTINCT AREA_TYPE FROM connected_plant_uat.gold.gold_em_result LIMIT 50;
```

| Contract field | Expected column | Status |
|---|---|---|
| `sampleId` | `EM_RESULT_ID` or `SAMPLE_ID` | `[ ]` blocked |
| `locationId` | `LOCATION_ID` | `[ ]` blocked |
| `zoneId` | `ZONE_ID` | `[ ]` blocked |
| `hygieneZone` | `HYGIENE_ZONE` | `[ ]` blocked |
| `areaType` | `AREA_TYPE` | `[ ]` blocked |
| `sampleDate` | `SAMPLE_DATE` | `[ ]` blocked |
| `testType` | `TEST_TYPE` | `[ ]` blocked |
| `result` | `RESULT` | `[ ]` blocked |
| `resultValue` | `RESULT_VALUE` | `[ ]` blocked |
| `unit` | `UOM` | `[ ]` blocked |
| `plantId` | `PLANT_ID` | `[ ]` blocked |

---

## How to Update This Checklist

1. Confirm source view name with domain owner.
2. Run `DESCRIBE TABLE <catalog>.<schema>.<view>` in the Databricks SQL Editor.
3. For each field found, change status from `[ ] blocked` to `[x] confirmed-ddl` and record the date.
4. For enums (`hygieneZone`, `areaType`, `result`), run `SELECT DISTINCT` and verify values match the Zod enum in `environmental-monitoring.ts`.
5. If a column is not found, mark `missing` and note the date.
6. Do not wire any QuerySpec or route until all required fields for that slice are `confirmed-ddl`.

Once a view is confirmed, update `docs/audit/envmon-databricks-source-candidates.md` to change the candidate status from `Unconfirmed` to `confirmed-ddl`, and update `docs/audit/domain-source-truth-matrix.md` §7.
