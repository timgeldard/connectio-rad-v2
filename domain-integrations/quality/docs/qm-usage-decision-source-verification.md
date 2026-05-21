# QM Usage-Decision Source Verification Pack

**Status:** verification pack ready — no SQL has been run; all evidence fields are `not run`
**Created:** 2026-05-21
**Open blocker:** TRACE-P1-012
**Related doc:** `quality-databricks-source-verification.md` covers the broader inspection/MIC/lot/CoA/deviation universe; this document is scoped to usage-decision source verification only.

These are candidate sources. This document does not claim that any source is authoritative until object existence, schema, grain, join keys, and business semantics are verified.

---

## 1. Purpose

Establish whether the QM usage-decision source in `connected_plant_uat.gold` can safely support read-only display in V2.

This pack must answer:

1. Which Databricks object is the authoritative usage-decision source?
2. What is the object type: table, view, metric view, or other?
3. What columns exist?
4. What is the grain?
5. How does it join to material, batch, plant, inspection lot, process order, and traceability data?
6. What do the usage-decision codes and texts mean?
7. Is the source current-state only or historical?
8. Can it support read-only evidence display?
9. Can it support release-status semantics? Assume no unless a governed mapping exists.
10. Which V2 domains can safely consume it, and with what caveats?

---

## 2. Known Candidate Sources

From V1 source discovery (`quality-v1-source-discovery.md`) and TRACE-P1-012:

| Candidate Object | V1 Evidence | Catalog Confirmed | Purpose |
|---|---|---|---|
| `gold_inspection_usage_decision` | TRACE-P1-012: confirmed in catalog 2026-05-21 | Object located — schema/semantics unverified | Usage-decision code, text, valuation, score, created by/date |
| `vw_gold_inspection_usage_decision` | V1: ConnectedQuality, POH order detail | Not confirmed in current UAT catalog | Usage-decision code, valuation, quality score, created by/date |
| `gold_batch_quality_lot_v` | V1: Trace2 quality record | V1-discovered; UAT existence not run | Batch quality inspection lot evidence, includes `USAGE_DECISION_LONG_TEXT` |
| `gold_batch_quality_summary_v` | V1: Trace2 quality record | V1-discovered; UAT existence not run | Batch-level quality result counts |
| `vw_gold_quality_result_enriched` | V1: POH Quality Analytics | Not confirmed in current UAT catalog | Includes `usage_decision_code`, `valuation_code`, `quality_score` |

**Note on `gold_inspection_usage_decision`:** TRACE-P1-012 (recorded 2026-05-21) states this object is available in the catalog. However, its schema, grain, join keys, and business semantics are not verified. The SAP QM `vw_gold_inspection_usage_decision` name used in V1 may resolve to this same object under a different naming convention.

The broader V1 field inventory (`quality-v1-source-discovery.md` §SAP QM Concept Mapping) lists:
- `USAGE_DECISION_CODE`, `USAGE_DECISION_LONG_TEXT`, `VALUATION_CODE`, `QUALITY_SCORE`
- `USAGE_DECISION_CREATED_BY`, `USAGE_DECISION_CREATED_DATE`

These are V1-observed names only. Do not assume they match current UAT column names.

---

## 3. Current Open Blocker: TRACE-P1-012

**Defect:** TRACE-P1-012 in `domain-integrations/traceability/docs/traceability-defect-backlog.md`

**Summary:** Several Traceability and Quality panels need a verified QM usage-decision source. The catalog has `gold_inspection_usage_decision` available (confirmed live 2026-05-21) but its schema, semantics, and join keys are not yet verified.

**Affected panels:**
- `MaterialSupplierExposurePanel` — `openSupplierActions` and `highestRiskSupplier` remain absent until QM source verified
- `ProductionHistoryPanel` — Pass/Fail labels from the gold view are not the SAP QM release decision
- `BatchHeaderPanel` — `qualityStatus` is conservative (`pending`/`unknown` only)
- Quality `QualityReadOnlyEvidencePanel` — returns `pending-source-verification`

**Current status:** verification pack ready. No SQL has been run. Object is located in catalog but unverified.

---

## 4. What Is Known from V1/V2 Discovery

| Known Fact | Source | Confidence |
|---|---|---|
| `gold_inspection_usage_decision` exists in `connected_plant_uat.gold` | TRACE-P1-012 live check 2026-05-21 | Object located — unverified schema |
| `vw_gold_inspection_usage_decision` used in V1 POH and ConnectedQuality | `quality-v1-source-discovery.md` | V1 usage confirmed |
| V1 fields include `USAGE_DECISION_CODE`, `VALUATION_CODE`, `QUALITY_SCORE`, creator, created date | `quality-v1-source-discovery.md` §V1 Backend / API / Source Inventory | V1 only |
| `gold_batch_quality_lot_v` includes `USAGE_DECISION_LONG_TEXT` per V1 Trace2 | `quality-v1-source-discovery.md` | V1 only |
| V1 code uses broad heuristics (`LIKE 'A%' => accepted`) — not a governed release mapping | `quality-v1-source-discovery.md` §Usage Decision And Release-Status Assessment | Confirmed V1 anti-pattern |
| No V1 usage-decision write-back, release/reject posting, or e-signature found | `quality-v1-source-discovery.md` | Confirmed absence |
| SAP code assumptions (`A`/`R`/`C`) exist in `quality-decision-source-plan.md` | `quality-decision-source-plan.md` | Unverified assumptions — do not treat as confirmed |

---

## 5. What Is Not Yet Verified

- Current UAT object existence for all candidates except `gold_inspection_usage_decision` (located, unverified schema)
- Actual column names and data types for all candidates
- Primary grain and uniqueness for all candidates
- Join key between usage-decision object and material/batch/plant/inspection lot
- Whether the UAT object is the same as the V1 `vw_gold_inspection_usage_decision`
- Whether null or absent usage-decision rows mean "no decision taken" vs. "inspection lot does not require UD"
- Governed SAP QM code/text semantics for `USAGE_DECISION_CODE` values
- Governed mapping from any code to accepted, released, rejected, conditional, or blocked
- Whether the source is current-state or historical (one row per decision version or one per lot)
- Whether `QUALITY_SCORE` and `VALUATION_CODE` are meaningful for V2 display
- Leading-zero preservation requirements for `INSPECTION_LOT_ID`, `MATERIAL_ID`, `BATCH_ID`

---

## 6. Object Discovery SQL

Run these first to discover actual UAT object names. Do not assume the candidate names exist.

```sql
SHOW TABLES IN connected_plant_uat.gold LIKE '*usage*';
SHOW TABLES IN connected_plant_uat.gold LIKE '*decision*';
SHOW TABLES IN connected_plant_uat.gold LIKE '*inspection*decision*';
SHOW TABLES IN connected_plant_uat.gold LIKE '*quality*decision*';
SHOW TABLES IN connected_plant_uat.gold LIKE '*qave*';
SHOW TABLES IN connected_plant_uat.gold LIKE '*ud*';
```

Also run the broader inspection and quality inventories from `quality-databricks-source-verification.md` §4 to identify all candidate objects in one pass.

Record every matching table or view in the evidence table (§13).

---

## 7. DESCRIBE / SHOW CREATE SQL

Run these only for objects found in the discovery step above. Replace placeholder names with actual verified names.

```sql
-- Primary candidate (catalog-confirmed by TRACE-P1-012)
DESCRIBE EXTENDED connected_plant_uat.gold.gold_inspection_usage_decision;
SHOW CREATE TABLE connected_plant_uat.gold.gold_inspection_usage_decision;

-- V1-discovered view candidate
DESCRIBE EXTENDED connected_plant_uat.gold.vw_gold_inspection_usage_decision;
SHOW CREATE TABLE connected_plant_uat.gold.vw_gold_inspection_usage_decision;

-- Batch quality lot candidate (contains USAGE_DECISION_LONG_TEXT per V1)
DESCRIBE EXTENDED connected_plant_uat.gold.gold_batch_quality_lot_v;
SHOW CREATE TABLE connected_plant_uat.gold.gold_batch_quality_lot_v;

-- Batch quality summary candidate
DESCRIBE EXTENDED connected_plant_uat.gold.gold_batch_quality_summary_v;
SHOW CREATE TABLE connected_plant_uat.gold.gold_batch_quality_summary_v;
```

Capture for each object:

- Object name and type (table, view, metric view, or other)
- All column names and data types
- Nullable status where available
- Column comments if available
- Source owner if available
- Freshness/update columns if available

Look specifically for fields corresponding to:
- inspection lot ID
- material ID
- batch ID
- plant ID
- process order ID
- usage decision code
- usage decision text
- valuation code
- quality score
- decision date/time
- created by / changed by
- current/final indicator
- status
- source system
- load/update timestamp

---

## 8. Grain Verification SQL

Run after column names are confirmed. Replace `<verified_usage_decision_object>` with the actual object name.

```sql
-- Total row count
SELECT COUNT(*) AS row_count
FROM connected_plant_uat.gold.<verified_usage_decision_object>;

-- Check for multiple rows per inspection lot (expected: 0 duplicates if grain = one per lot)
SELECT
  inspection_lot_id,
  COUNT(*) AS rows
FROM connected_plant_uat.gold.<verified_usage_decision_object>
GROUP BY inspection_lot_id
HAVING COUNT(*) > 1
ORDER BY rows DESC
LIMIT 50;

-- Check for multiple rows per material + batch + plant
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

-- Check for multiple rows per material + batch + plant + inspection lot
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

-- Null inspection lot frequency
SELECT
  COUNT(*) AS total_rows,
  COUNT(inspection_lot_id) AS rows_with_lot,
  COUNT(*) - COUNT(inspection_lot_id) AS rows_without_lot
FROM connected_plant_uat.gold.<verified_usage_decision_object>;
```

Replace column names if the actual verified names differ. Do not rewrite SQL from memory.

---

## 9. Join-Key Verification SQL

Run after grain is established and column names confirmed.

```sql
-- Verify join to inspection lot source (if vw_gold_inspection_lot or equivalent exists)
SELECT
  ud.*,
  il.MATERIAL_ID AS lot_material,
  il.BATCH_ID AS lot_batch,
  il.PLANT_ID AS lot_plant
FROM connected_plant_uat.gold.<verified_usage_decision_object> ud
LEFT JOIN connected_plant_uat.gold.<verified_inspection_lot_object> il
  ON il.INSPECTION_LOT_ID = ud.inspection_lot_id
WHERE ud.inspection_lot_id IS NOT NULL
LIMIT 50;

-- Verify join to batch header (gold_batch_stock_v or equivalent)
SELECT
  ud.material_id,
  ud.batch_id,
  ud.inspection_lot_id,
  ud.usage_decision_code,
  s.PLANT_ID
FROM connected_plant_uat.gold.<verified_usage_decision_object> ud
LEFT JOIN connected_plant_uat.gold.gold_batch_stock_v s
  ON s.MATERIAL_ID = ud.material_id
 AND s.BATCH_ID = ud.batch_id
WHERE ud.material_id IS NOT NULL
  AND ud.batch_id IS NOT NULL
LIMIT 50;

-- Check for batches in traceability UAT candidate that have a usage decision
-- (Reference candidate: MATERIAL_ID=000000000020052009, BATCH_ID=0008602411, PLANT_ID=C061)
SELECT *
FROM connected_plant_uat.gold.<verified_usage_decision_object>
WHERE material_id IN ('000000000020052009', '20052009')
  AND batch_id IN ('0008602411', '8602411')
LIMIT 25;
```

---

## 10. Code/Text Semantics Verification

Run after column names and object existence are confirmed.

```sql
-- Distinct usage decision codes and texts (raw values — do not interpret as release statuses)
SELECT
  usage_decision_code,
  usage_decision_text,
  COUNT(*) AS rows
FROM connected_plant_uat.gold.<verified_usage_decision_object>
GROUP BY usage_decision_code, usage_decision_text
ORDER BY rows DESC
LIMIT 100;

-- Distinct valuation codes
SELECT
  valuation_code,
  COUNT(*) AS rows
FROM connected_plant_uat.gold.<verified_usage_decision_object>
GROUP BY valuation_code
ORDER BY rows DESC
LIMIT 100;

-- Null/empty code frequency
SELECT
  COUNT(*) AS total_rows,
  COUNT(usage_decision_code) AS rows_with_code,
  COUNT(CASE WHEN usage_decision_code = '' THEN 1 END) AS rows_empty_code,
  COUNT(*) - COUNT(usage_decision_code) AS rows_null_code
FROM connected_plant_uat.gold.<verified_usage_decision_object>;
```

These queries capture raw values only. The mapping of any code to accepted/released/rejected/conditional must not be inferred — it must come from a governed SAP QM process owner confirmation.

---

## 11. Current-vs-Historical Verification

```sql
-- Check whether decision date column exists and has variance
SELECT
  MIN(usage_decision_created_date) AS earliest_decision,
  MAX(usage_decision_created_date) AS latest_decision,
  COUNT(DISTINCT usage_decision_created_date) AS distinct_dates
FROM connected_plant_uat.gold.<verified_usage_decision_object>;

-- Check whether an inspection lot has multiple decision rows over time
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
```

A source that returns multiple rows per inspection lot over time is historical. A source that returns exactly one row per lot is current-state. Record actual result — do not assume.

---

## 12. Cross-Domain Consumption Rules

See `qm-usage-decision-cross-domain-consumption-plan.md` for the full per-domain rules. Summary:

| Domain | Safe Use (post-verification) | Blocked Until |
|---|---|---|
| Traceability batch header | Display source code/text as read-only evidence | Object, grain, join keys, and semantics verified |
| Traceability supplier exposure | No supplier risk calculation from UD | Supplier/batch causality and risk rules defined separately |
| Traceability production history | Show UD evidence alongside `quality_status`; keep them distinct | Object and join to material/batch verified |
| Quality read-only evidence panel | Display source code/text as read-only evidence | Object, grain, and join keys verified |
| POH | Display UD for process order if join to inspection lot/PO verified | Object and PO/lot join verified |
| SPC | Not applicable — UD is not SPC control status | n/a |
| Genie | Cite source UD code/text; block "Can this batch be released?" | n/a — always blocked |

---

## 13. Evidence Capture Table

| Check | SQL Run | Expected Evidence | Actual Result | Verified By | Date | Status | Notes |
|---|---|---|---|---|---|---|---|
| Object inventory: `*usage*` | `SHOW TABLES ... '*usage*'` | Candidate objects listed | TBD | TBD | TBD | not run | |
| Object inventory: `*decision*` | `SHOW TABLES ... '*decision*'` | Candidate objects listed | TBD | TBD | TBD | not run | |
| Object inventory: `*inspection*decision*` | `SHOW TABLES ... '*inspection*decision*'` | Candidate objects listed | TBD | TBD | TBD | not run | |
| Object inventory: `*quality*decision*` | `SHOW TABLES ... '*quality*decision*'` | Candidate objects listed | TBD | TBD | TBD | not run | |
| Object existence: `gold_inspection_usage_decision` | `DESCRIBE EXTENDED ...` | Schema captured | TBD | TBD | TBD | not run | Catalog-located by TRACE-P1-012 2026-05-21 |
| Object existence: `vw_gold_inspection_usage_decision` | `DESCRIBE EXTENDED ...` | Schema captured or not found | TBD | TBD | TBD | not run | |
| Object existence: `gold_batch_quality_lot_v` | `DESCRIBE EXTENDED ...` | Schema captured or not found | TBD | TBD | TBD | not run | |
| Object existence: `gold_batch_quality_summary_v` | `DESCRIBE EXTENDED ...` | Schema captured or not found | TBD | TBD | TBD | not run | |
| SHOW CREATE: primary candidate | `SHOW CREATE TABLE ...` | Source definition captured | TBD | TBD | TBD | not run | |
| Grain: one row per inspection lot | Duplicate check on `inspection_lot_id` | 0 duplicates (or documented exceptions) | TBD | TBD | TBD | not run | |
| Grain: one row per material/batch/plant | Duplicate check on composite key | 0 duplicates (or documented exceptions) | TBD | TBD | TBD | not run | |
| Join key: to inspection lot | Join query | Rows joined without fan-out | TBD | TBD | TBD | not run | |
| Join key: to batch header (material/batch) | Join query | Rows joined without fan-out | TBD | TBD | TBD | not run | |
| Code/text distribution | Distinct code/text query | Raw values captured, no release mapping | TBD | TBD | TBD | not run | |
| Valuation code distribution | Distinct valuation query | Raw values captured | TBD | TBD | TBD | not run | |
| Null code frequency | Null/empty check | Null rate documented | TBD | TBD | TBD | not run | |
| Historical vs. current-state | Multiple rows per lot check | Source type documented | TBD | TBD | TBD | not run | |
| UAT traceability candidate match | Join to MATERIAL_ID=20052009/BATCH_ID=8602411 | Row found or explicitly absent | TBD | TBD | TBD | not run | |

Status values:
- `not run`
- `verified`
- `partially verified`
- `not found`
- `blocked`
- `unexpected`

---

## 14. Go/No-Go Criteria

### Go — usage-decision display may be added when

- The authoritative object is confirmed with `DESCRIBE` evidence.
- Column names are captured (not assumed from V1).
- Grain is verified: one row per inspection lot, or documented exceptions.
- At least one join key to material/batch or inspection lot is verified without fan-out.
- At least one raw code/text value is captured from the actual object.
- No release-status mapping is required for the first display slice.

### No-Go — do not wire until

- Object does not exist or cannot be queried.
- Column names are not captured.
- Grain is unknown.
- Join key produces fan-out or unexpected row counts.
- Usage-decision code semantics are unknown but release status is requested.
- Any release/reject action, SAP QM write-back, e-signature, or GxP workflow is requested.
- Service-principal fallback would be needed.

---

## 15. Backlog Items

| Priority | Item | Notes |
|---|---|---|
| P0 | Run object inventory SQL (§6) against `connected_plant_uat.gold` | Gate for all subsequent checks |
| P0 | Run DESCRIBE on `gold_inspection_usage_decision` (catalog-located) | Gate for grain/join verification |
| P0 | Populate §13 evidence table with actual results | Required before any native route is implemented |
| P1 | Verify grain and join keys (§8–9) | Required before join is used in any adapter |
| P1 | Capture raw code/text distribution (§10) | Required before any display; do not invent codes |
| P1 | Determine current-state vs. historical (§11) | Affects adapter query design |
| P1 | Get governed SAP QM code mapping from Quality/QM process owner | Required before any accepted/released/rejected display |
| P2 | Verify leading-zero preservation for lot/material/batch IDs | Required before joining to traceability data |
| P2 | Check `QUALITY_SCORE` and `VALUATION_CODE` semantics | Required before display of these fields |
| P3 | Cross-domain consumption plan review once evidence is populated | See `qm-usage-decision-cross-domain-consumption-plan.md` |
