# Golden SPC Candidates — UAT Data Register

**Date:** 2026-05-20  
**Status:** No verified live SPC UAT candidate has been identified from V1 discovery.  
**UAT Target Catalog:** `connected_plant_uat.gold`  

---

## Purpose

This file records confirmed plant / material / MIC combinations that can be used for live SPC UAT validation once V2 SPC routes are wired to V1 Databricks sources.

A candidate must be verified — it must have real data in `connected_plant_uat.gold.spc_quality_metric_subgroup_v` for the target plant/material/MIC combination before being used for UAT.

---

## Candidate Discovery Protocol

Because the V1 codebase does not contain hardcoded plant/material/MIC test combinations and discovers materials dynamically, candidates must be retrieved directly from the live Databricks SQL Warehouse.

To discover candidates, run the following query in your Databricks SQL editor:

```sql
-- Query to find top 20 candidate combinations with recent SPC data
SELECT
  material_id,
  plant_id,
  mic_id,
  COUNT(DISTINCT batch_id) AS batch_count,
  COUNT(*) AS sample_points_count,
  MIN(sample_timestamp) AS earliest_sample_ts,
  MAX(sample_timestamp) AS latest_sample_ts
FROM connected_plant_uat.gold.spc_quality_metric_subgroup_v
WHERE sample_timestamp >= DATEADD(day, -90, CURRENT_TIMESTAMP())
GROUP BY material_id, plant_id, mic_id
HAVING COUNT(DISTINCT batch_id) >= 15
ORDER BY sample_points_count DESC
LIMIT 20;
```

> [!NOTE]
> Column names like `sample_timestamp` and `material_id` are verified from V1 migration `005_create_spc_quality_metric_subgroup_v.sql`.

---

## Candidate Register Template

When a candidate is confirmed via UAT data access, copy this template and add it to the list of verified candidates below.

```markdown
### Candidate: [Material Description / Plant Name]

| Field | Value |
|-------|-------|
| Material ID | — |
| Material Name | — |
| Plant ID | — |
| Plant Name | — |
| MIC ID | — |
| MIC Name | — |
| Operation ID | — |
| Chart Type (V1) | — |
| Date Range | — |
| Expected Point Count | — |
| Limit Source | live / locked |
| Expected Signal Count | — |
| Expected Capability (Cpk) | — |
| Data Source | spc_quality_metric_subgroup_v |
| Verified by | [Developer/QA Name] |
| Verified at | [YYYY-MM-DD] |
| Validation Status | confirmed |
```

---

## Verified UAT Candidates

*No candidates confirmed yet. Populate this section during the implementation/UAT phase once Databricks SQL query access is established.*

---

## Prerequisite Checklist Before UAT Validation

- [ ] V1 SPC app URL confirmed accessible in UAT Databricks workspace (backlog item SPC-B01)
- [ ] V1 gold view column names verified against metadata DDL (backlog item SPC-B07)
- [ ] V2 SPC legacy-api proxy routes implemented (backlog items SPC-B03, SPC-B04)
- [ ] V2 SPC workspace entry updated to material-first navigation (backlog item SPC-B01)
