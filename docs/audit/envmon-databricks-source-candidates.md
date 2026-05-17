# EnvMon Databricks Source Candidates

**Date:** 2026-05-17
**Tranche:** i.txt groundwork
**Status:** ALL CANDIDATES UNCONFIRMED — none identified in repo code or docs; all are speculative
**Reference:** i.txt §3, `docs/audit/domain-source-truth-matrix.md` §7

---

## Summary

Zero Databricks gold views have been confirmed or identified for EnvMon. The source system is LIMS. The candidates below are **entirely speculative** — inferred from:
- Common LIMS/environmental monitoring data patterns
- SAP QM / inspection lot naming conventions used elsewhere in this repo
- i.txt §3 candidate object list

None of these objects have been searched for in the Databricks workspace, confirmed via DDL, or verified from repo code. Do not treat any of these as confirmed.

The `docs/audit/domain-source-truth-matrix.md` §7 already states: "No gold views confirmed. No planning path identified. Requires domain owner to identify Databricks source."

---

## Candidate Objects

### Group A — Inspection Lot / Quality Result (SAP QM origin)

These would only be relevant if LIMS environmental sampling results flow through SAP QM inspection lots before landing in Databricks. Confirm with the domain owner whether this is the case.

| Object name | Catalog | Schema | Purpose | Status |
|---|---|---|---|---|
| `gold_inspection_lot` | `connected_plant_uat` | `gold` (assumed) | Inspection lot header — lot ID, material, plant, status | **Unconfirmed** — not found in repo |
| `gold_inspection_point` | `connected_plant_uat` | `gold` (assumed) | Inspection points / sampling locations | **Unconfirmed** |
| `vw_gold_inspection_result` | `connected_plant_uat` | `csm_process_order_history` or `gold` (assumed) | Individual inspection results — characteristic, value, specification | **Unconfirmed** |
| `vw_gold_inspection_specification` | `connected_plant_uat` | `gold` (assumed) | Inspection specs — tolerance, limit values | **Unconfirmed** |
| `gold_batch_quality_result` | `connected_plant_uat` | `gold` (assumed) | Quality results per batch | **Unconfirmed** |
| `gold_batch_quality_result_v` | `connected_plant_uat` | `gold` (assumed) | Quality results view (enriched) | **Unconfirmed** |
| `gold_batch_quality_lot_v` | `connected_plant_uat` | `gold` (assumed) | Quality lot view | **Unconfirmed** |

### Group B — LIMS-native Objects (if LIMS has its own gold views)

These would be relevant if LIMS exports directly to Databricks with its own schema, independent of SAP QM.

| Object name | Catalog | Schema | Purpose | Status |
|---|---|---|---|---|
| `em_location_coordinates` | Unknown | Unknown | Sampling point floor plan coordinates for heatmap | **Unconfirmed** |
| `em_plant_floor` | Unknown | Unknown | Plant floor plan grid definition | **Unconfirmed** |
| `lims_swab_result` | Unknown | Unknown | LIMS swab test result — sample, organism, value, result | **Unconfirmed** |
| `lims_sampling_point` | Unknown | Unknown | Sampling point master — location, zone, hygiene zone | **Unconfirmed** |
| `lims_corrective_action` | Unknown | Unknown | CAPA records from LIMS | **Unconfirmed** |

### Group C — EnvMon-specific Gold Views (if already built by data engineering)

If the data engineering team has already built EnvMon gold views in the `connected_plant_uat` catalog, they would most likely follow the naming convention of existing views.

| Object name | Catalog | Schema | Purpose | Status |
|---|---|---|---|---|
| `gold_em_result` | `connected_plant_uat` | Unknown | Environmental monitoring result (LIMS swab) | **Unconfirmed** |
| `gold_em_location` | `connected_plant_uat` | Unknown | Sampling point / location master | **Unconfirmed** |
| `gold_em_zone` | `connected_plant_uat` | Unknown | Zone master with hygiene zone classification | **Unconfirmed** |
| `gold_em_corrective_action` | `connected_plant_uat` | Unknown | CAPA / corrective action records | **Unconfirmed** |
| `vw_gold_em_summary` | `connected_plant_uat` | Unknown | Aggregated site summary | **Unconfirmed** |

---

## How to Confirm

1. Ask the data engineering or domain owner team: "Does `connected_plant_uat` have any gold views for environmental monitoring / LIMS swab data?"
2. Run exploratory SQL in the Databricks workspace:

```sql
-- List all schemas in the catalog
SHOW SCHEMAS IN connected_plant_uat;

-- If a relevant schema is found, list its views/tables
SHOW TABLES IN connected_plant_uat.<schema_name>;

-- Or search by naming convention across gold schema
SHOW TABLES IN connected_plant_uat.gold;
```

3. Once a candidate view is named, run `DESCRIBE TABLE` and update `docs/audit/envmon-native-column-verification-checklist.md`.

---

## Why No Candidates Are Confirmed

The existing repo docs and source code contain zero references to EnvMon-specific Databricks views. The V1 CQ Lab adapter references `vw_gold_quality_result_enriched` and `metric_quality_daily` — but those are for quality results linked to process order inspection lots, not standalone LIMS environmental swab sampling. They should not be assumed to cover EnvMon without verification.

Until the domain owner identifies the correct source views, **no QuerySpecs, no routes, and no code changes** should be made for EnvMon.
