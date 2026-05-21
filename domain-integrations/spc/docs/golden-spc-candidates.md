# Golden SPC Candidates — UAT Data Register

**Date updated:** 2026-05-21
**Status:** No verified live SPC UAT candidate has been identified from V1 discovery.
Databricks SQL access required to identify and confirm candidates.
**UAT Target Catalog:** `connected_plant_uat.gold`

> **IMPORTANT:** No candidate values (material IDs, plant IDs, MIC IDs) have been invented,
> assumed, or pre-populated. Every field in the candidate evidence template must be populated
> from actual `connected_plant_uat.gold` query results by a person with live Databricks access.
> Do NOT add a candidate based on documentation guesswork.

---

## 1. Current Status

| Item | Status |
|------|--------|
| V1 source objects discovered | Complete (code analysis only) |
| Confirmed candidates in UAT | None — Databricks access required |
| Candidate discovery queries ready | Yes — see Section 2 |
| Evidence template ready | Yes — see Section 3 |
| Validation checklist ready | Yes — see Section 4 |

SPC data exists in `connected_plant_uat.gold` per V1 source code and migration scripts.
However, whether any specific material/plant/MIC combination has real SPC data in the UAT
environment is unknown until the discovery queries below are run.

---

## 2. Candidate Discovery SQL

### 2.1 Primary candidate discovery query

Run this in a Databricks SQL Editor with access to `connected_plant_uat`:

```sql
-- Primary candidate discovery: find material/plant/MIC combinations with >= 20 batches
-- of SPC data in the last 90 days
SELECT
  s.material_id,
  s.plant_id,
  s.mic_id,
  s.operation_id,
  COUNT(DISTINCT s.batch_id)  AS batch_count,
  COUNT(*)                    AS sample_point_count,
  MIN(s.sample_timestamp)     AS date_from,
  MAX(s.sample_timestamp)     AS date_to,
  -- Check if locked limits exist for this combination
  CASE WHEN l.material_id IS NOT NULL THEN 'locked_limits_exist' ELSE 'live_only' END
    AS limit_source
FROM connected_plant_uat.gold.spc_quality_metric_subgroup_v s
LEFT JOIN connected_plant_uat.gold.spc_locked_limits l
  ON  s.material_id = l.material_id
  AND s.mic_id      = l.mic_id
  AND (s.plant_id   = l.plant_id  OR l.plant_id IS NULL)
WHERE s.sample_timestamp >= DATEADD(day, -90, CURRENT_TIMESTAMP())
GROUP BY
  s.material_id,
  s.plant_id,
  s.mic_id,
  s.operation_id,
  CASE WHEN l.material_id IS NOT NULL THEN 'locked_limits_exist' ELSE 'live_only' END
HAVING COUNT(DISTINCT s.batch_id) >= 20
ORDER BY sample_point_count DESC
LIMIT 20;
```

> Note: Column names `sample_timestamp`, `material_id`, `plant_id`, `mic_id`, `operation_id`,
> `batch_id` in `spc_quality_metric_subgroup_v` are from V1 migration source analysis. Verify
> against live `DESCRIBE TABLE` output before running this query.

> Note: Column names `material_id`, `mic_id`, `plant_id` in `spc_locked_limits` are from V1
> source. Verify similarly.

### 2.2 Lower threshold discovery (if >= 20 batches returns no results)

```sql
-- Relaxed threshold: find combinations with >= 5 batches
SELECT
  material_id,
  plant_id,
  mic_id,
  operation_id,
  COUNT(DISTINCT batch_id)  AS batch_count,
  COUNT(*)                  AS sample_point_count,
  MIN(sample_timestamp)     AS date_from,
  MAX(sample_timestamp)     AS date_to
FROM connected_plant_uat.gold.spc_quality_metric_subgroup_v
WHERE sample_timestamp >= DATEADD(day, -180, CURRENT_TIMESTAMP())
GROUP BY material_id, plant_id, mic_id, operation_id
HAVING COUNT(DISTINCT batch_id) >= 5
ORDER BY sample_point_count DESC
LIMIT 20;
```

### 2.3 Chart type discovery for a candidate

After identifying a candidate material/plant/MIC, determine the expected chart type:

```sql
-- Check if a chart type override exists for this MIC
SELECT *
FROM connected_plant_uat.gold.spc_mic_chart_config
WHERE material_id = '<candidate_material>'
  AND plant_id    = '<candidate_plant>'
  AND mic_id      = '<candidate_mic>';

-- If no override, derive from subgroup size (xbar_r for n > 1, imr for n = 1)
SELECT
  batch_id,
  COUNT(*) AS samples_in_subgroup
FROM connected_plant_uat.gold.spc_quality_metric_subgroup_v
WHERE material_id = '<candidate_material>'
  AND plant_id    = '<candidate_plant>'
  AND mic_id      = '<candidate_mic>'
GROUP BY batch_id
ORDER BY batch_id
LIMIT 20;
```

### 2.4 Capability check for a candidate

```sql
SELECT *
FROM connected_plant_uat.gold.spc_capability_detail_mv
WHERE material_id = '<candidate_material>'
  AND plant_id    = '<candidate_plant>'
  AND mic_id      = '<candidate_mic>';
```

### 2.5 Locked limits check for a candidate

```sql
SELECT *
FROM connected_plant_uat.gold.spc_locked_limits
WHERE material_id = '<candidate_material>'
  AND mic_id      = '<candidate_mic>';
```

---

## 3. Candidate Evidence Template

When a candidate is confirmed from live UAT query results, create a new entry using this
template. Do NOT pre-populate any field. All values must come from actual query results.

```markdown
### Candidate: [Material Description / Plant Name / MIC Name — to be filled from query]

| Field | Value |
|-------|-------|
| Material ID | — (from query result) |
| Material Name | — (from dimension MV or description lookup) |
| Plant ID | — (from query result) |
| Plant Name | — (from gold_plant or dimension MV) |
| MIC ID | — (from query result) |
| MIC Name | — (from characteristic_dim_mv.mic_name) |
| Operation ID | — (from query result; may be NULL) |
| Chart Type (V1) | — (from spc_mic_chart_config or subgroup size heuristic) |
| Date From | — (from MIN(sample_timestamp) in query) |
| Date To | — (from MAX(sample_timestamp) in query) |
| Expected Point Count | — (from sample_point_count in query) |
| Expected Batch Count | — (from batch_count in query) |
| Limit Source | — (live / locked_limits_exist — from query) |
| Expected Signal Count | — (not verified; run rule engine against chart data) |
| Expected Capability (Cpk) | — (from spc_capability_detail_mv if populated) |
| Source Objects | spc_quality_metric_subgroup_v [+ spc_locked_limits if locked] |
| Validated By | — (person who ran the query) |
| Validation Date | — (date of query run) |
| Validation Status | not verified |
```

---

## 4. Validation Checklist

Before marking a candidate as `confirmed`, the following must all be true:

- [ ] Material ID, Plant ID, MIC ID all confirmed from live query
- [ ] At least 20 sample points found in `spc_quality_metric_subgroup_v` for this combination
- [ ] Sample timestamps are within the last 180 days (data is reasonably current)
- [ ] `DESCRIBE TABLE` for `spc_quality_metric_subgroup_v` confirms expected column names match
- [ ] At least one subgroup data row fetched and inspected visually (SELECT * LIMIT 5)
- [ ] `result_value`, `subgroup_mean`, `subgroup_range`, `subgroup_sd` are non-NULL
- [ ] `unit_of_measure` is populated
- [ ] Chart type determined (from `spc_mic_chart_config` override or subgroup size)
- [ ] Locked limits: checked `spc_locked_limits` for this material/mic combination
- [ ] Capability: checked `spc_capability_detail_mv` for this material/plant/mic
- [ ] No PII or commercially sensitive data is being used for UAT
- [ ] Entry added to Section 5 (Verified UAT Candidates) with all fields completed

---

## 5. Verified UAT Candidates

No candidates confirmed yet. Populate this section during the implementation/UAT phase once
Databricks SQL query access is established and discovery queries have been run.

---

## 6. Prerequisite Checklist Before UAT Validation

- [ ] Databricks SQL Warehouse access confirmed (warehouse ID current)
- [ ] `connected_plant_uat.gold` catalog accessible (Unity Catalog, OAuth)
- [ ] `SHOW TABLES` confirms SPC objects exist in catalog
- [ ] `DESCRIBE TABLE spc_quality_metric_subgroup_v` run and column names verified
- [ ] Discovery query (Section 2.1) run and results captured
- [ ] At least one candidate identified from discovery query
- [ ] Candidate entry created in Section 5 with all fields from query results
- [ ] V2 SPC backlog items SPC-B01 through SPC-B07 complete (navigation model, proxy routes, adapter)
