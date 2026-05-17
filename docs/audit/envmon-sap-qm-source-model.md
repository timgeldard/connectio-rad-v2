# EnvMon SAP QM Source Model

**Date:** 2026-05-17
**Tranche:** k.txt — SAP QM source recovery
**Status:** CONFIRMED-V1 — DDL verification pending in connected_plant_uat
**Evidence source:** V1 ConnectIO-RAD repo (`apps/envmon/backend/envmon_backend/`), `ai-context/semantic-model/entities.yaml`
**Reference:** `docs/migration/envmon-v1-functional-recovery.md`

---

## Source System: SAP QM via Databricks Gold Layer

EnvMon V1 reads SAP Quality Management inspection lot data from the same Databricks catalog as Trace2:

| Attribute | Value | Evidence |
|---|---|---|
| Catalog env var | `TRACE_CATALOG` | V1 `em_config.py` |
| Schema env var | `TRACE_SCHEMA` (default: `gold`) | V1 `em_config.py` |
| Catalog (UAT) | `connected_plant_uat` (assumed — same as Trace2) | Object resolver convention |
| Schema (UAT) | `gold` (default — same as Trace2) | Object resolver convention |
| Object resolver key | `"envmon"` → maps to TRACE_CATALOG / TRACE_SCHEMA | `apps/api/shared/query_service/object_resolver.py` |

---

## View 1: `gold_inspection_lot`

**Purpose:** SAP QM inspection lot header — one row per inspection lot  
**Role in EnvMon:** Primary query target; `INSPECTION_TYPE IN ('14','Z14')` is the domain boundary filter

| Attribute | Value |
|---|---|
| Catalog | `connected_plant_uat` |
| Schema | `TRACE_SCHEMA` (default `gold`) |
| Full name | `connected_plant_uat.gold.gold_inspection_lot` |
| Evidence | V1 `em_config.py` `LOT_TBL_NAME` + `entities.yaml` + `plants.py` DAL SQL |

**Confirmed-v1 columns:**

| Column | Type | Role | Evidence |
|---|---|---|---|
| `INSPECTION_LOT_ID` | string | Primary key | entities.yaml |
| `PLANT_ID` | string | Plant filter (`WHERE PLANT_ID = :plant_id`) | plants.py DAL |
| `INSPECTION_TYPE` | string | Domain filter (`IN ('14','Z14')`) | em_config.py + all DAL files |
| `CREATED_DATE` | date | Period filter | plants.py `fetch_plant_kpis` |
| `INSPECTION_END_DATE` | date | Lot completion | entities.yaml |
| `MATERIAL_ID` | string | Enrichment (optional) | entities.yaml |
| `BATCH_ID` | string | Enrichment (optional) | entities.yaml |

**Joins required:**
- → `gold_inspection_point` on `INSPECTION_LOT_ID`

---

## View 2: `gold_inspection_point`

**Purpose:** Inspection sample points — one row per sample point per lot  
**Role in EnvMon:** Maps inspection lots to physical floor locations via `FUNCTIONAL_LOCATION` (SAP TPLNR)

| Attribute | Value |
|---|---|
| Catalog | `connected_plant_uat` |
| Schema | `TRACE_SCHEMA` (default `gold`) |
| Full name | `connected_plant_uat.gold.gold_inspection_point` |
| Evidence | V1 `em_config.py` `POINT_TBL_NAME` + `entities.yaml` + `plants.py` DAL SQL |

**Confirmed-v1 columns:**

| Column | Type | Role | Evidence |
|---|---|---|---|
| `INSPECTION_LOT_ID` | string | FK → gold_inspection_lot | entities.yaml + plants.py join |
| `INSPECTION_POINT_ID` | string | Point identifier within lot | entities.yaml |
| `FUNCTIONAL_LOCATION` | string | SAP TPLNR (e.g. `Q225-0101-SEV3-Z0-72`); maps to physical floor position | entities.yaml + plants.py `FUNCTIONAL_LOCATION IS NOT NULL` |
| `OPERATION_ID` | string | Join key to gold_batch_quality_result_v | plants.py `ip.OPERATION_ID = r.OPERATION_ID` |
| `SAMPLE_ID` | string | Join key to gold_batch_quality_result_v | plants.py `ip.SAMPLE_ID = r.SAMPLE_ID` |
| `SAMPLE_HOUR` | integer | Hour the sample was collected | entities.yaml |

**Joins required:**
- ← `gold_inspection_lot` on `INSPECTION_LOT_ID`
- → `gold_batch_quality_result_v` on `INSPECTION_LOT_ID + OPERATION_ID + SAMPLE_ID`

---

## View 3: `gold_batch_quality_result_v`

**Purpose:** MIC test results — one row per characteristic (MIC) per sample point  
**Role in EnvMon:** Provides inspection result valuations, numeric values, and specification limits

| Attribute | Value |
|---|---|
| Catalog | `connected_plant_uat` |
| Schema | `TRACE_SCHEMA` (default `gold`) |
| Full name | `connected_plant_uat.gold.gold_batch_quality_result_v` |
| Evidence | V1 `em_config.py` `RESULT_TBL_NAME` + `entities.yaml` + `plants.py` DAL SQL |

**Confirmed-v1 columns:**

| Column | Type | Role | Evidence |
|---|---|---|---|
| `INSPECTION_LOT_ID` | string | Join key (composite FK, part 1 of 3) | plants.py LEFT JOIN |
| `OPERATION_ID` | string | Join key (composite FK, part 2 of 3) | plants.py LEFT JOIN |
| `SAMPLE_ID` | string | Join key (composite FK, part 3 of 3) | plants.py LEFT JOIN |
| `MIC_NAME` | string | Characteristic / organism name (e.g. Listeria, APC, ATP) | entities.yaml |
| `INSPECTION_RESULT_VALUATION` | string | Result status: `R`/`REJ`/`REJECT`=FAIL, `W`/`WARN`=WARNING, `A`=ACCEPT, NULL=PENDING | entities.yaml + plants.py valuation SQL |
| `QUANTITATIVE_RESULT` | decimal | Numeric result value (CFU count, RLU, etc.) | entities.yaml |
| `UPPER_TOLERANCE` | decimal | Upper specification limit | entities.yaml |
| `LOWER_TOLERANCE` | decimal | Lower specification limit | entities.yaml |

**Joins required:**
- ← `gold_inspection_point` on `INSPECTION_LOT_ID + OPERATION_ID + SAMPLE_ID`

---

## View 4: `gold_plant` (shared)

**Purpose:** Plant master — plant name, country, city  
**Role in EnvMon:** Enrichment only; same view used by CQ Lab and Trace2  
**Status:** confirmed-ddl (verified 2026-05-17 via `getLabPlants` browser verification)

| Attribute | Value |
|---|---|
| Catalog | `connected_plant_uat` |
| Schema | `gold` |
| Full name | `connected_plant_uat.gold.gold_plant` |
| Confirmed-ddl columns | `PLANT_ID`, `PLANT_NAME` (confirmed via `getLabPlants` BV 2026-05-17) |
| Country/city | `COUNTRY_ID`, `CITY` — confirmed-v1 from V1 `plants.py` `fetch_plant_metadata` |

---

## App-Managed Tables (V1 app layer — existence in connected_plant_uat UNKNOWN)

These tables are owned and populated by the V1 EnvMon app, not by data engineering. They may not exist in `connected_plant_uat`.

| Table | Catalog/schema in V1 | Confirmed-v1 columns | Role | Risk |
|---|---|---|---|---|
| `em_location_coordinates` | `EM_CATALOG.EM_SCHEMA` | `func_loc_id`, `floor_id`, `x_pos`, `y_pos` (%), `plant_id` | Maps FUNCTIONAL_LOCATION to floor plan coordinates for heatmap | HIGH — may not exist in connected_plant_uat |
| `em_plant_floor` | `EM_CATALOG.EM_SCHEMA` | `plant_id`, `floor_id`, `floor_name`, `svg_url`, `svg_width`, `svg_height`, `active_revision_id` | Floor plan SVG definition per plant | HIGH — may not exist |
| `em_plant_geo` | `EM_CATALOG.EM_SCHEMA` | `plant_id`, `lat`, `lon` | Plant geographic coordinates for site map | HIGH — may not exist |
| `em_location_zones` | `EM_CATALOG.EM_SCHEMA` | unknown | Zone/hygiene zone classification per FUNCTIONAL_LOCATION | HIGH — may not exist |
| `em_layout_revision` | `EM_CATALOG.EM_SCHEMA` | unknown | SVG revision tracking | HIGH — may not exist |

**Do not implement heatmap or zone-level queries without confirming em_* table existence via `SHOW TABLES`.**

---

## Relationship Diagram

```
gold_inspection_lot  (INSPECTION_TYPE IN ('14','Z14'))
    │ INSPECTION_LOT_ID
    │
    ▼
gold_inspection_point
    │ INSPECTION_LOT_ID + OPERATION_ID + SAMPLE_ID
    │
    ▼
gold_batch_quality_result_v
    (MIC_NAME, INSPECTION_RESULT_VALUATION, QUANTITATIVE_RESULT)
```

For heatmap only (app-managed — may not exist):
```
gold_inspection_point.FUNCTIONAL_LOCATION
    │ func_loc_id
    │
    ▼
em_location_coordinates  (x_pos, y_pos, floor_id)
    │ floor_id
    │
    ▼
em_plant_floor  (svg_url, svg_width, svg_height)
```

---

## Method → Source Mapping

| V2 method | Required views | app-managed? | Safe now? |
|---|---|---|---|
| `getEnvMonSiteSummary` | lot + point + result_v | No | **Yes** — V1 KPI query confirmed |
| `getEnvMonSwabResults` | lot + point + result_v | No | After DDL verification |
| `getEnvMonTrends` | lot + point + result_v | No | After DDL verification |
| `getEnvMonZones` | lot + point + em_location_zones | **Yes** | Blocked — em_location_zones may not exist |
| `getEnvMonAlerts` | lot + point + result_v (derived) | No | Deferred — alert derivation rules undefined |
| `getEnvMonHeatmap` | lot + point + result_v + em_location_coordinates + em_plant_floor | **Yes** | Blocked — em_* may not exist |
| `getEnvMonCorrectiveActions` | CAPA source unknown | — | Blocked — no CAPA source confirmed |
| `getEnvMonSwabVectors` | complex derivation | — | Deferred indefinitely — business rules undefined |
| `getEnvMonContext` | contextual (aggregation) | No | After site summary confirmed |

---

## DDL Verification Queue

Run these in Databricks SQL Editor before wiring any route:

```sql
-- Required views
DESCRIBE TABLE connected_plant_uat.gold.gold_inspection_lot;
DESCRIBE TABLE connected_plant_uat.gold.gold_inspection_point;
DESCRIBE TABLE connected_plant_uat.gold.gold_batch_quality_result_v;

-- Confirm inspection type values
SELECT DISTINCT INSPECTION_TYPE, COUNT(*) AS n
FROM connected_plant_uat.gold.gold_inspection_lot
GROUP BY INSPECTION_TYPE ORDER BY n DESC;

-- Confirm valuation values
SELECT DISTINCT INSPECTION_RESULT_VALUATION, COUNT(*) AS n
FROM connected_plant_uat.gold.gold_batch_quality_result_v
GROUP BY INSPECTION_RESULT_VALUATION ORDER BY n DESC;

-- Check for app-managed tables
SHOW TABLES IN connected_plant_uat.gold LIKE 'em_%';
```

Update `docs/audit/envmon-native-column-verification-checklist.md` after running DDL.
