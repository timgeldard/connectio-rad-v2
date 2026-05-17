# EnvMon V1 Functional Recovery

**Date:** 2026-05-17
**Tranche:** k.txt — SAP QM source recovery
**Status:** SOURCE RECOVERED (confirmed-v1) — DDL verification pending in connected_plant_uat
**References:**
- `docs/audit/envmon-sap-qm-source-model.md`
- `docs/audit/envmon-inspection-lot-type-filter.md`
- `docs/audit/envmon-native-column-verification-checklist.md`

---

## Summary

EnvMon V1 was a fully functional application. It is **not** a LIMS-native app — it reads SAP Quality Management inspection lot data from the Databricks gold layer, filtering to inspection types `'14'` and `'Z14'` (recurring environmental inspection lots).

The V1 source was recovered by searching the `ConnectIO-RAD` repo using SAP QM terminology (INSPECTION_TYPE, gold_inspection_lot, gold_inspection_point) rather than "LIMS" or "envmon" filenames.

---

## V1 App Location

| Item | Path |
|---|---|
| Backend root | `apps/envmon/backend/envmon_backend/` |
| Config/table refs | `utils/em_config.py` |
| DAL — plants/KPI | `inspection_analysis/dal/plants.py` |
| DAL — heatmap | `inspection_analysis/dal/heatmap.py` |
| DAL — trends | `inspection_analysis/dal/trends.py` |
| DAL — lot/MIC detail | `inspection_analysis/dal/lots.py` |

---

## Source System

**SAP QM** (Quality Management) inspection lots, not LIMS.

V1 reads from the same Databricks catalog as Trace2: `TRACE_CATALOG` / `TRACE_SCHEMA` (default `gold`).

From `em_config.py` (V1):

```python
LOT_TBL_NAME    = f"{TRACE_CATALOG}.{TRACE_SCHEMA}.gold_inspection_lot"
POINT_TBL_NAME  = f"{TRACE_CATALOG}.{TRACE_SCHEMA}.gold_inspection_point"
RESULT_TBL_NAME = f"{TRACE_CATALOG}.{TRACE_SCHEMA}.gold_batch_quality_result_v"
```

Additional gold view used for plant metadata:
```python
PLANT_TBL       = f"{TRACE_CATALOG}.{TRACE_SCHEMA}.gold_plant"    # shared with CQ/Trace
```

App-managed tables (V1 app layer — **may NOT exist in connected_plant_uat**):
```python
PLANT_GEO_TBL   = f"{EM_CATALOG}.{EM_SCHEMA}.em_plant_geo"
FLOOR_TBL       = f"{EM_CATALOG}.{EM_SCHEMA}.em_plant_floor"
COORD_TBL       = f"{EM_CATALOG}.{EM_SCHEMA}.em_location_coordinates"
```

---

## Inspection Lot Types (critical filter)

```python
# V1 em_config.py
INSPECTION_TYPES: tuple[str, ...] = ("14", "Z14")
INSP_TYPES_SQL: str = "('14', 'Z14')"
```

Every V1 EnvMon query begins with `WHERE lot.INSPECTION_TYPE IN ('14', 'Z14')`.

Type 14 = recurring inspection (environmental monitoring, hygiene swabs, plant monitoring).
Type Z14 = customer extension of type 14.

---

## Gold Views Used (confirmed-v1)

### 1. `gold_inspection_lot`

Inspection lot header — one row per inspection lot.

**Confirmed-v1 columns (from entities.yaml + V1 DAL):**
| Column | Role |
|---|---|
| `INSPECTION_LOT_ID` | Primary key |
| `PLANT_ID` | Plant filter |
| `INSPECTION_TYPE` | EnvMon filter: `IN ('14','Z14')` |
| `CREATED_DATE` | Date filter (period window) |
| `INSPECTION_END_DATE` | Lot completion date |
| `MATERIAL_ID` | Material on the lot (optional enrichment) |
| `BATCH_ID` | Batch on the lot (optional enrichment) |

### 2. `gold_inspection_point`

Inspection points — one row per sample point per lot.

**Confirmed-v1 columns (from entities.yaml + V1 DAL join keys):**
| Column | Role |
|---|---|
| `INSPECTION_LOT_ID` | FK → gold_inspection_lot |
| `INSPECTION_POINT_ID` | Point identifier within lot |
| `FUNCTIONAL_LOCATION` | SAP TPLNR — physical floor location (e.g. `Q225-0101-SEV3-Z0-72`) |
| `OPERATION_ID` | Join key to gold_batch_quality_result_v |
| `SAMPLE_ID` | Join key to gold_batch_quality_result_v |
| `SAMPLE_HOUR` | Hour the sample was taken |

### 3. `gold_batch_quality_result_v`

MIC test results — one row per characteristic per sample.

**Confirmed-v1 columns (from entities.yaml + V1 DAL):**
| Column | Role |
|---|---|
| `INSPECTION_LOT_ID` | Join key (part of composite FK) |
| `OPERATION_ID` | Join key (part of composite FK) |
| `SAMPLE_ID` | Join key (part of composite FK) |
| `MIC_NAME` | Characteristic / test type (e.g. Listeria, APC, ATP) |
| `INSPECTION_RESULT_VALUATION` | Result status: `R`/`REJ`/`REJECT`=FAIL, `W`/`WARN`=WARNING, `A`=ACCEPT, NULL=PENDING |
| `QUANTITATIVE_RESULT` | Numeric result value (CFU count, RLU, etc.) |
| `UPPER_TOLERANCE` | Upper specification limit |
| `LOWER_TOLERANCE` | Lower specification limit |

---

## Join Keys (confirmed-v1)

From V1 `plants.py` `fetch_plant_kpis`:

```sql
FROM gold_inspection_lot lot
JOIN gold_inspection_point ip
    ON lot.INSPECTION_LOT_ID = ip.INSPECTION_LOT_ID
LEFT JOIN gold_batch_quality_result_v r
    ON ip.INSPECTION_LOT_ID = r.INSPECTION_LOT_ID
   AND ip.OPERATION_ID      = r.OPERATION_ID
   AND ip.SAMPLE_ID         = r.SAMPLE_ID
```

---

## V1 UI Screens / Features

| Feature | V1 Implementation | Source |
|---|---|---|
| Plant list | `fetch_active_plant_ids` — DISTINCT PLANT_ID from lots type 14/Z14 | `plants.py` |
| Plant KPIs (90d) | `fetch_plant_kpis` — aggregate by FUNCTIONAL_LOCATION, classify valuations | `plants.py` |
| Plant metadata | `fetch_plant_metadata` — gold_plant PLANT_NAME, COUNTRY_ID, CITY | `plants.py` |
| Heatmap | Floor plan SVG + em_location_coordinates + lot/point/result join | `heatmap.py` |
| MIC trends | Time-series MIC results per location, by test type | `trends.py` |
| Lot detail | Per-location lot listing + per-lot MIC characteristics | `lots.py` |
| Floor count | `count_plant_floors` — COUNT from em_plant_floor | `plants.py` |

---

## Result Valuation Mapping (confirmed-v1)

From V1 `plants.py` `fetch_plant_kpis` SQL:

| SAP valuation | Category | V2 equivalent |
|---|---|---|
| `R`, `REJ`, `REJECT` | Fail | `positive` / `active_fail` |
| `W`, `WARN` | Warning | `borderline` / `warning` |
| NULL | Pending (no usage decision) | `pending` |
| `A` (or other) | Accept / Pass | `negative` / `pass` |

---

## App-Managed Tables (V1 only — existence in UAT unknown)

These tables are managed by the EnvMon app itself (not data engineering gold views):

| Table | Contents | Risk for V2 |
|---|---|---|
| `em_location_coordinates` | floor_id, func_loc_id, x_pos, y_pos, plant_id | May not exist in connected_plant_uat — required for heatmap |
| `em_plant_floor` | plant_id, floor_id, floor_name, svg_url, svg_width, svg_height, active_revision_id | May not exist — required for floor plan rendering |
| `em_plant_geo` | plant_id, lat, lon | May not exist — required for site map |
| `em_location_zones` | zone/hygiene zone classification per functional location | May not exist — required for zone-level aggregation |
| `em_layout_revision` | SVG revision tracking | May not exist |

**Safe slices avoid em_* tables entirely.** The V1 `plants.py` KPI query uses only `gold_inspection_lot + gold_inspection_point + gold_batch_quality_result_v` — no em_* joins. This is the basis for the first safe V2 slice.

---

## First Safe V2 Slice

**Method:** `getEnvMonSiteSummary`
**Reason:** V1 `fetch_plant_kpis` uses ONLY the three gold views — no app-managed tables.
**QuerySpec:** `apps/api/adapters/envmon/envmon_databricks_adapter.py` → `get_site_summary_spec`
**Status:** QuerySpec-only (confirmed-v1) — DDL not yet run; no route wired

---

## What Was Searched

| Term | Location | Result |
|---|---|---|
| `envmon`, `LIMS`, `lims` | V2 repo, adapter code | Not found in Databricks context — confirmed wrong search terms |
| `gold_inspection_lot`, `INSPECTION_TYPE`, `em_config` | V1 ConnectIO-RAD repo | Found — full EnvMon source model recovered |
| `INSP_TYPES`, `('14', 'Z14')` | V1 repo | Found in `em_config.py` |
| `gold_batch_quality_result_v` | V1 repo | Found in `em_config.py` `RESULT_TBL_NAME` |
| `entities.yaml` (semantic model) | V1 ai-context | Found — confirmed column names for all three gold views |

---

## What Remains Pending

| Item | Status | Next action |
|---|---|---|
| `DESCRIBE TABLE gold_inspection_lot` in UAT | pending | Run in Databricks SQL Editor |
| `DESCRIBE TABLE gold_inspection_point` in UAT | pending | Run in Databricks SQL Editor |
| `DESCRIBE TABLE gold_batch_quality_result_v` in UAT | pending | Run in Databricks SQL Editor |
| `SELECT DISTINCT INSPECTION_TYPE` in UAT | pending | Confirm `'14'` and `'Z14'` are present |
| em_* table existence in connected_plant_uat | unknown | Run `SHOW TABLES IN connected_plant_uat.gold` and look for em_* |
| V2 route for `/api/envmon/site-summary` | deferred | Wire only after DDL confirmed |
