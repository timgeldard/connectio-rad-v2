# Golden SPC Candidates — UAT Data Register

**Date:** 2026-05-20
**Status:** No verified live SPC UAT candidate has been identified from V1 discovery.

---

## Purpose

This file records confirmed plant / material / MIC combinations that can be used for live SPC UAT validation once V2 SPC routes are wired to V1 Databricks sources.

A candidate must be verified — it must have real data in `connected_plant_uat.gold.spc_quality_metric_subgroup_v` for the target plant/material/MIC combination before being used for UAT.

---

## Status

No verified live SPC UAT candidate has been identified from V1 source discovery.

V1 source code does not contain hardcoded plant/material/MIC test combinations. The V1 SPC app discovers materials dynamically via `GET /api/spc/materials` → `GET /api/spc/plants?material_id=...` → `GET /api/spc/characteristics?material_id=...&plant_id=...`. No fixture data or seeded test candidates were found in the V1 frontend or backend code.

---

## Candidate Template

When a candidate is confirmed via UAT data access, record it here using this format:

```
### Candidate: [Short label]

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
| Verified by | — |
| Verified at | — |
| Validation Status | unverified / confirmed |
```

---

## How to Discover Candidates

Once V1 SPC app URL is confirmed as accessible in the UAT environment:

1. Open V1 SPC app → type a material ID in the material picker
2. Select a plant with SPC data
3. Confirm at least one MIC with ≥ 20 data points in the last 90 days
4. Note the chart type shown (imr / xbar_r / etc.)
5. Optionally run control limits to confirm UCL/LCL are reasonable
6. Record the combination in this file with `Validation Status: confirmed`

Alternatively, run a discovery query against `connected_plant_uat.gold`:

```sql
-- Candidate discovery query (run against connected_plant_uat.gold)
-- Returns material/plant/MIC combinations with recent SPC data
SELECT
  material_id,
  plant_id,
  mic_id,
  COUNT(DISTINCT batch_id) AS batch_count,
  COUNT(*) AS point_count,
  MIN(sample_timestamp) AS first_sample,
  MAX(sample_timestamp) AS last_sample
FROM connected_plant_uat.gold.spc_quality_metric_subgroup_v
WHERE sample_timestamp >= DATEADD(day, -90, CURRENT_TIMESTAMP)
GROUP BY material_id, plant_id, mic_id
HAVING COUNT(DISTINCT batch_id) >= 10
ORDER BY point_count DESC
LIMIT 20;
```

**Note:** Do not run this query until column names have been verified against the actual V1 view DDL (`apps/spc/scripts/migrations/005_create_spc_quality_metric_subgroup_v.sql`). Column names may differ from V2 documentation.

---

## Prerequisite Before UAT Candidate Validation

- [ ] V1 SPC app URL confirmed accessible in UAT Databricks workspace
- [ ] V1 gold view column names verified (backlog item SPC-B07)
- [ ] V2 SPC legacy-api proxy routes implemented (backlog items SPC-B08, SPC-B09)
- [ ] V2 SPC workspace entry updated to material-first navigation (SPC-B03)
