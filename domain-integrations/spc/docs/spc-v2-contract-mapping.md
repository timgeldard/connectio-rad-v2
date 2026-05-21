# SPC V2 Contract Mapping

**Date:** 2026-05-21
**Status:** Template only — all confidence values are "pending Databricks verification"
or "unknown". No V2 field has been confirmed as mapped to a live Databricks source.
**Source of truth for V2 contracts:** `packages/data-contracts/src/schemas/spc-monitoring.ts`

> **IMPORTANT:** This document maps V2 Zod schema fields to expected Databricks sources.
> None of these mappings have been verified by live Databricks execution. All confidence
> values are set to "pending Databricks verification" or "unknown" until the verification
> queries in `spc-databricks-source-verification.md` are run and the evidence tables are
> filled in.

---

## 1. Purpose

This document provides a field-by-field mapping from V2 data contracts
(`@connectio/data-contracts` `spc-monitoring.ts`) to expected Databricks source objects and
columns. It is the reference document for implementing native V2 SPC routes once Databricks
verification is complete.

Reading guide:
- **Expected Databricks Source**: which Databricks object is expected to provide this field
- **Expected Column**: the column name as known from V1 source code (NOT confirmed against live DDL)
- **Transform Needed**: any rename, type conversion, or derivation required
- **Required?**: whether this field is required in the V2 Zod schema
- **Verification Query**: which query in `spc-databricks-source-verification.md` confirms this
- **Confidence**: all set to "pending" until verification runs
- **Gap / Risk**: known gaps from V1 source discovery

---

## 2. ChartTypeSchema

V2 chart types vs V1 chart_type values (rename required):

| V2 ChartTypeSchema value | V1 `chart_type` value | Rename needed? |
|--------------------------|----------------------|----------------|
| `xbar-r` | `xbar_r` | Yes |
| `xbar-s` | `xbar_s` | Yes |
| `individuals` | `imr` | Yes |
| `p-chart` | `p_chart` | Yes |
| `np-chart` | `np_chart` | Yes |
| `c-chart` | `c_chart` | Yes |
| `u-chart` | `u_chart` | Yes |
| `ewma` | `ewma` | No (same) |
| `cusum` | `cusum` | No (same) |

---

## 3. LimitProvenanceSchema

| V2 value | When to use |
|----------|-------------|
| `mock-fixture` | Mock adapter only |
| `calculated-from-sample` | Live mode: UCL/LCL computed from subgroup statistics using AIAG constants |
| `imported-from-approved-source` | Locked mode: limits read from `spc_locked_limits` |
| `unknown` | Cannot determine source |

---

## 4. ApprovalStateSchema

| V2 value | When to use |
|----------|-------------|
| `approved` | `spc_locked_limits.locked_by` is present (limits were locked by an identified user) |
| `not-approved` | Live-computed limits (no lock record) |
| `pending-validation` | Locked limits present but locked_by is a UAT/test identity |
| `unavailable` | `spc_locked_limits` table absent, or limit columns NULL |

---

## 5. SPCMonitoringContext

| V2 Contract / Field | Expected Databricks Source | Expected Column | Transform Needed | Required? | Verification Query | Confidence | Gap / Risk |
|---------------------|---------------------------|-----------------|------------------|-----------|-------------------|------------|------------|
| `plantId` | V1 context state / `spc_plant_material_dim_mv` | `plant_id` | Direct | Yes | DESCRIBE plant_material_dim_mv | pending | None |
| `plantName` | `gold_plant` or `spc_plant_material_dim_mv` | `plant_name` | Direct | Yes | DESCRIBE gold_plant | pending | Column name in gold_plant unverified |
| `materialId` | V1 context state / `spc_material_dim_mv` | `material_id` | Direct | Yes | DESCRIBE material_dim_mv | pending | Must be first-class required param in V2 request |
| `materialDescription` | `spc_material_dim_mv` | `material_name` or `material_description` | Direct | Yes | Sample rows from material_dim_mv | pending | Column name unconfirmed |
| `batchId` | N/A — not a primary V1 SPC filter | N/A | N/A | No | N/A | unknown | V1 is material+plant scoped, not batch scoped |
| `workCentreId` | `spc_quality_metric_subgroup_v` | `operation_id` | Rename | No | DISTINCT operation_id values | pending | `workCentreId` ≠ `operation_id`; naming gap |
| `characteristicId` | `spc_characteristic_dim_mv` | `mic_id` | Direct | No | DESCRIBE characteristic_dim_mv | pending | Same value as micId |
| `chartType` | V1 context state / `spc_mic_chart_config` | `chart_type` | Rename enum | No | DESCRIBE spc_mic_chart_config | pending | V1 uses `imr` etc.; V2 uses `individuals` etc. |
| `activeSignals` | Frontend-computed | `detectRules()` count on current chart data | Requires chart data | Yes | N/A | unknown | Not stored; must compute |
| `highestSeverity` | Frontend-computed | Derived from rule violations | Requires chart data | Yes | N/A | unknown | Not stored |
| `lastUpdatedAt` | `spc_quality_metric_subgroup_v` | `sample_timestamp` (MAX) | Direct | Yes | Sample rows | pending | |
| `activeScope` | N/A | Generated | N/A | No | N/A | unknown | |
| `activeView` | N/A | Generated | N/A | No | N/A | unknown | |

---

## 6. SPCSummary

| V2 Contract / Field | Expected Databricks Source | Expected Column | Transform Needed | Required? | Verification Query | Confidence | Gap / Risk |
|---------------------|---------------------------|-----------------|------------------|-----------|-------------------|------------|------------|
| `chartsMonitored` | `spc_characteristic_dim_mv` | COUNT(*) | COUNT aggregate | Yes | Row count query | pending | 4h stale if using MV |
| `activeSignals` | Frontend-computed | `detectRules()` on current data | Must compute | Yes | N/A | unknown | No stored aggregate |
| `outOfControlSignals` | Frontend-computed | Rule type severity derivation | Must compute | Yes | N/A | unknown | |
| `warningSignals` | Frontend-computed | Rule type severity derivation | Must compute | Yes | N/A | unknown | |
| `characteristicsAtRisk` | `spc_nelson_rule_flags_mv` | COUNT of MICs with recent flags | Aggregate | Yes | DESCRIBE nelson_rule_flags_mv | pending | 4h stale |
| `highestSeverity` | Frontend-computed or `spc_nelson_rule_flags_mv` | Derived | Derive | Yes | N/A | unknown | |
| `recommendedAction` | Static text | N/A | Static | Yes | N/A | unknown | Not stored in V1 |
| `confidence` | Derived | Data completeness ratio | Compute | Yes | N/A | unknown | Not a V1 concept |

---

## 7. SPCSignal

| V2 Contract / Field | Expected Databricks Source | Expected Column | Transform Needed | Required? | Verification Query | Confidence | Gap / Risk |
|---------------------|---------------------------|-----------------|------------------|-----------|-------------------|------------|------------|
| `signalId` | Frontend-computed | Generated: `{ruleCode}-{pointIndex}` | Generate | Yes | N/A | unknown | No stored signal IDs |
| `characteristicId` | Chart context | `mic_id` | Direct | Yes | N/A | pending | |
| `characteristicName` | Chart context | `mic_name` | Direct | Yes | N/A | pending | |
| `materialId` | Chart context | `material_id` | Direct | Yes | N/A | pending | |
| `batchId` | `spc_quality_metric_subgroup_v` | `batch_id` | Direct | Yes | Sample rows | pending | |
| `plantId` | Chart context | `plant_id` | Direct | Yes | N/A | pending | |
| `chartType` | Chart context | `chart_type` | Rename enum | Yes | N/A | pending | |
| `rule` | `detectWECORules()` / `detectNelsonRules()` | Rule description string | Direct | Yes | N/A | pending (frontend) | |
| `ruleCode` | `detectWECORules()` / `detectNelsonRules()` | `WE1`–`WE4` or `N1`–`N8` | Direct | Yes | N/A | pending (frontend) | |
| `severity` | Derived | Rule type mapping (N1/WE1=critical) | Mapping | Yes | N/A | unknown | |
| `detectedAt` | `spc_quality_metric_subgroup_v` | `sample_timestamp` | Direct | Yes | Sample rows | pending | |
| `samplePointId` | `spc_quality_metric_subgroup_v` | `sample_id` | Direct | Yes | Sample rows | pending | |
| `resultValue` | `spc_quality_metric_subgroup_v` | `result_value` or `subgroup_mean` | Conditional | Yes | Sample rows | pending | Depends on chart type |
| `recommendedAction` | Static text / SOP reference | N/A | Static | Yes | N/A | unknown | Not stored in V1 |
| `status` | Hardcoded | Always `'active'` for current chart data | Hardcode | Yes | N/A | unknown | No alarm lifecycle in V1 |

---

## 8. ControlChartPoint

| V2 Contract / Field | Expected Databricks Source | Expected Column | Transform Needed | Required? | Verification Query | Confidence | Gap / Risk |
|---------------------|---------------------------|-----------------|------------------|-----------|-------------------|------------|------------|
| `pointId` | Generated | `{mic_id}-{sample_id}` | Generate | Yes | N/A | unknown | |
| `timestamp` | `spc_quality_metric_subgroup_v` | `sample_timestamp` | Direct | Yes | Sample rows | pending | |
| `value` | `spc_quality_metric_subgroup_v` | `subgroup_mean` (xbar-r) or `result_value` (imr) | Conditional on chart type | Yes | Sample rows | pending | |
| `batchId` | `spc_quality_metric_subgroup_v` | `batch_id` | Direct | No | Sample rows | pending | |
| `sampleId` | `spc_quality_metric_subgroup_v` | `sample_id` | Direct | No | Sample rows | pending | |
| `signalIds` | Frontend-computed | From `detectRules()` | Must compute | Yes | N/A | unknown | Empty array if no signals |
| `status` | Frontend-computed | From `detectRules()` output | Must compute | Yes | N/A | unknown | |

---

## 9. ControlChartSeries

| V2 Contract / Field | Expected Databricks Source | Expected Column | Transform Needed | Required? | Verification Query | Confidence | Gap / Risk |
|---------------------|---------------------------|-----------------|------------------|-----------|-------------------|------------|------------|
| `chartId` | Generated | `{material_id}-{mic_id}-{chart_type}` | Generate | Yes | N/A | unknown | |
| `chartType` | `spc_quality_metric_subgroup_v` / `spc_mic_chart_config` | `chart_type` | Rename enum | Yes | Sample rows | pending | |
| `characteristicId` | `spc_characteristic_dim_mv` | `mic_id` | Direct | Yes | DESCRIBE char_dim_mv | pending | |
| `characteristicName` | `spc_characteristic_dim_mv` | `mic_name` | Direct | Yes | DESCRIBE char_dim_mv | pending | |
| `points` | `spc_quality_metric_subgroup_v` | Multiple columns | Array transform | Yes | Full drill-down query | pending | |
| `centerLine` | `spc_locked_limits.cl` (locked) or computed | `cl` | Direct or compute | No | Sample locked_limits | pending | |
| `upperControlLimit` | `spc_locked_limits.ucl` (locked) or computed | `ucl` | Direct or compute | No | Sample locked_limits | pending | |
| `lowerControlLimit` | `spc_locked_limits.lcl` (locked) or computed | `lcl` | Direct or compute | No | Sample locked_limits | pending | |
| `upperSpecLimit` | `spc_quality_metric_subgroup_v.usl_spec` | `usl_spec` | Direct | No | Sample rows | pending | |
| `lowerSpecLimit` | `spc_quality_metric_subgroup_v.lsl_spec` | `lsl_spec` | Direct | No | Sample rows | pending | |
| `unitOfMeasure` | `spc_quality_metric_subgroup_v` | `unit_of_measure` | Direct | Yes | Sample rows | pending | |
| `confidence` | Derived | Data completeness ratio | Compute | Yes | N/A | unknown | |
| `limitProvenance` | Derived | `'imported-from-approved-source'` if locked_by present, else `'calculated-from-sample'` | Logic | No | locked_limits query | pending | |
| `approvalState` | `spc_locked_limits.locked_by` | Derived from locked_by presence | Logic | No | locked_limits query | pending | |
| `lockedLimits` | `spc_locked_limits` | EXISTS check | Boolean | No | locked_limits query | pending | |
| `lockedFrom` | `spc_locked_limits` | `effective_from` or `baseline_from` (unconfirmed) | Direct | No | DESCRIBE locked_limits | pending | Column name unconfirmed |
| `lockedTo` | `spc_locked_limits` | `effective_to` or `baseline_to` (unconfirmed) | Direct | No | DESCRIBE locked_limits | pending | Column name unconfirmed |

---

## 10. CharacteristicCapability

| V2 Contract / Field | Expected Databricks Source | Expected Column | Transform Needed | Required? | Verification Query | Confidence | Gap / Risk |
|---------------------|---------------------------|-----------------|------------------|-----------|-------------------|------------|------------|
| `characteristicId` | `spc_capability_detail_mv` | `mic_id` | Direct | Yes | DESCRIBE capability_mv | pending | |
| `characteristicName` | `spc_capability_detail_mv` | `mic_name` | Direct | Yes | Sample capability | pending | |
| `cp` | `spc_capability_detail_mv` | `cp` | Direct | Yes | Sample capability | pending | |
| `cpk` | `spc_capability_detail_mv` | `cpk` | Direct | Yes | Sample capability | pending | |
| `pp` | `spc_capability_detail_mv` | `pp` | Direct | Yes | Sample capability | pending | |
| `ppk` | `spc_capability_detail_mv` | `ppk` | Direct | Yes | Sample capability | pending | |
| `sampleCount` | `spc_capability_detail_mv` | `sample_count` | Direct | Yes | Sample capability | pending | |
| `mean` | `spc_capability_detail_mv` | `mean` | Direct | Yes | Sample capability | pending | |
| `standardDeviation` | `spc_capability_detail_mv` | `sigma_within` (expected) | Direct | Yes | Sample capability | pending | Column name unconfirmed |
| `confidence` | Derived | Data completeness / staleness ratio | Compute | Yes | N/A | unknown | |
| `interpretation` | Derived in V2 | Threshold logic on `cpk` | Compute | Yes | N/A | pending | V1 has 4 thresholds; V2 has 3 |
| `limitProvenance` | `spc_locked_limits` (check if locked) | Derived | Logic | No | locked_limits query | pending | |
| `approvalState` | `spc_locked_limits.locked_by` | Derived | Logic | No | locked_limits query | pending | |

---

## 11. MonitoredSPCCharacteristic

| V2 Contract / Field | Expected Databricks Source | Expected Column | Transform Needed | Required? | Verification Query | Confidence | Gap / Risk |
|---------------------|---------------------------|-----------------|------------------|-----------|-------------------|------------|------------|
| `characteristicId` | `spc_characteristic_dim_mv` | `mic_id` | Direct | Yes | DESCRIBE char_dim_mv | pending | |
| `characteristicName` | `spc_characteristic_dim_mv` | `mic_name` | Direct | Yes | DESCRIBE char_dim_mv | pending | |
| `micId` | `spc_characteristic_dim_mv` | `mic_id` | Direct | No | DESCRIBE char_dim_mv | pending | Same as characteristicId |
| `chartType` | `spc_mic_chart_config` or heuristic | `chart_type` | Rename enum | Yes | DESCRIBE mic_chart_config | pending | |
| `batchCount` | `spc_characteristic_dim_mv` | `batch_count` (expected) | Direct | Yes | Sample char_dim_mv | pending | Column name unconfirmed |
| `avgSamplesPerBatch` | `spc_characteristic_dim_mv` | Derived | Divide | No | Sample char_dim_mv | pending | |
| `hasActiveSignal` | `spc_nelson_rule_flags_mv` | Presence of recent flag | Derived | Yes | Sample nelson_rule_flags | pending | 4h stale |
| `highestSignalSeverity` | `spc_nelson_rule_flags_mv` | Derived from flag severity | Logic | No | Sample nelson_rule_flags | pending | Not a stored field |
| `operationId` | `spc_characteristic_dim_mv` | `operation_id` | Direct | No | DESCRIBE char_dim_mv | pending | |
| `chartTypeSource` | `spc_mic_chart_config` | `'override'` if present, else `'heuristic'` | Logic | No | DESCRIBE mic_chart_config | pending | |

---

## 12. SPCAlarmHistoryItem

| V2 Contract / Field | Expected Databricks Source | Expected Column | Transform Needed | Required? | Verification Query | Confidence | Gap / Risk |
|---------------------|---------------------------|-----------------|------------------|-----------|-------------------|------------|------------|
| `alarmId` | None | N/A | N/A | Yes | N/A | unknown | **No alarm history table exists in V1** |
| `timestamp` | None | N/A | N/A | Yes | N/A | unknown | |
| `characteristicId` | None | N/A | N/A | Yes | N/A | unknown | |
| `rule` | None | N/A | N/A | Yes | N/A | unknown | |
| `ruleCode` | None | N/A | N/A | No | N/A | unknown | |
| `severity` | None | N/A | N/A | Yes | N/A | unknown | |
| `status` | None | N/A | N/A | Yes | N/A | unknown | |
| `acknowledgedBy` | None | N/A | N/A | No | N/A | unknown | |
| `acknowledgedAt` | None | N/A | N/A | No | N/A | unknown | |
| `linkedBatchId` | `spc_nelson_rule_flags_mv` | `batch_id` | Low-confidence derivation | No | Sample nelson_rule_flags | unknown | Not a stored alarm log; batch-level only |

**Gap:** V1 has no alarm history storage. `SPCAlarmHistoryPanel` has no direct live data source.
Options: (a) remain mock-only, (b) approximate from `spc_nelson_rule_flags_mv` batches with flags,
(c) design a new V2 alarm storage table (out of scope for this verification pack).

---

## 13. SPCRelatedBatch

| V2 Contract / Field | Expected Databricks Source | Expected Column | Transform Needed | Required? | Verification Query | Confidence | Gap / Risk |
|---------------------|---------------------------|-----------------|------------------|-----------|-------------------|------------|------------|
| `batchId` | `spc_nelson_rule_flags_mv` | `batch_id` | Direct | Yes | Sample nelson_flags | pending | |
| `materialId` | `spc_nelson_rule_flags_mv` | `material_id` | Direct | Yes | Sample nelson_flags | pending | |
| `plantId` | `spc_nelson_rule_flags_mv` | `plant_id` | Direct | Yes | Sample nelson_flags | pending | |
| `status` | `gold_batch_quality_result_v` (join) | Batch disposition column (unconfirmed) | Join | Yes | DESCRIBE gold_batch_quality | pending | Requires join to batch status — column unconfirmed |
| `relatedSignalCount` | `spc_nelson_rule_flags_mv` | SUM of rule flags | Aggregate | Yes | Sample nelson_flags | pending | |
| `releaseImpact` | Derived | `blocking/risk/none` from signal count | Logic | Yes | N/A | unknown | Classification logic not defined |
| `drillThroughTarget` | Static | `'quality-batch-release'` | Static | No | N/A | pending | |
