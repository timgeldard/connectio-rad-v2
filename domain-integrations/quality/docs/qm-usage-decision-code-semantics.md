# QM Usage-Decision Code Semantics and Release-Status Boundaries

**Status:** not verified — no SQL has been run; code table is a placeholder
**Created:** 2026-05-21
**Related:** `qm-usage-decision-source-verification.md`, `quality-decision-source-plan.md`

This document defines what can and cannot be inferred from usage-decision codes and texts, and establishes the hard boundaries between QM usage decision and other quality-related concepts.

---

## 1. Hard Rule

> **V2 must display source usage-decision code/text first. It must not map to accepted, released, rejected, conditional, or blocked unless a governed SAP QM mapping is verified with the Quality/QM process owner.**

Missing usage-decision data must not be interpreted as accepted or released.

---

## 2. Actual Distinct Usage-Decision Codes/Texts

**Status: not verified.** The table below is a placeholder to be populated after the verification queries in §5 are run against `connected_plant_uat.gold`.

| Source Code | Source Text | Row Count | Proposed V2 Display | Release Meaning | Confidence | Governance Required |
|---|---|---:|---|---|---|---|
| TBD | TBD | TBD | TBD | not mapped | not run | Yes — QM process owner |

If Databricks access is available, populate this table using the queries in §5 before making any display decision. Do not insert assumed SAP QM code values.

**Note on V1 code assumptions:** `quality-decision-source-plan.md` contains example code assumptions (`A`=accept, `R`=reject, `C`=conditional). These are **unverified engineering assumptions** based on common SAP QM patterns — they are not a confirmed mapping from the Kerry process owner. Do not treat them as authoritative.

---

## 3. Concept Separation Table

The following concepts are distinct in SAP QM. V2 must not conflate them.

| Concept | SAP Source | V2 Source (if wired) | What it IS | What it is NOT |
|---|---|---|---|---|
| **SAP QM usage decision** | `vw_gold_inspection_usage_decision` or `gold_inspection_usage_decision` | Not yet wired | The QM inspection team's decision on the inspection lot (code + text) | Batch stock status, quality score, CoA document approval, SPC signal |
| **Inspection result valuation** | `vw_gold_inspection_result.INSPECTION_RESULT_VALUATION` | Not wired natively | Per-MIC pass/fail/warning valuation | Usage decision; release approval |
| **quality_status Pass/Fail** | `gold_batch_production_history_v.quality_status` | Wired in production history panel | Gold view labelling for production history context | SAP QM usage decision; not a release decision |
| **Batch stock status** | `gold_batch_stock_v` (UNRESTRICTED, BLOCKED, QI_HOLD, etc.) | Wired in batch header panel | Current stock bucket quantities | Quality inspection outcome; release decision |
| **Batch release approval** | SAP QM write-back (not implemented) | Not wired; blocked | Governed formal release act | Any of the above |
| **CoA document approval** | Not proven in V1 | Not wired | Controlled CoA document status | CoA-like result evidence |
| **SPC control status** | SPC control chart signals | SPC panel (mock only) | Process-control signal (Western Electric / Nelson rules) | QM inspection outcome; batch release |

---

## 4. Display Wording Rules

When displaying usage-decision evidence in V2:

| Situation | Required Display Wording | Prohibited Wording |
|---|---|---|
| Usage-decision code and text available | Show source code and text verbatim; label as "Usage decision (source)" | Do not add "Released", "Accepted", "Rejected" labels unless governed mapping exists |
| Usage-decision code available but text unavailable | Show code only; label "Usage decision code (source)" | Do not map code to human-readable status without governance |
| Usage-decision data absent (null code/text) | Show "No usage decision recorded" or "Evidence unavailable" | Do not show "Accepted", "Passed", "No issues", or "Compliant" |
| Multiple inspection lots for a batch | Show evidence for each lot; do not aggregate into a single "batch decision" | Do not synthesise a "batch release decision" from individual lot decisions without governance |
| quality_status is "Pass" | "Pass/Fail label from production history source" | Do not display as "Released", "Accepted", or "QM decision: Pass" |
| quality_status is "Fail" | "Pass/Fail label from production history source" | Do not display as "Rejected" or "Release blocked" |
| quality_status is "unknown" | "Quality status unknown — do not interpret as accepted or rejected" | Do not hide or suppress the unknown state |

---

## 5. Verification SQL for Code Semantics

Run only after the source object and column names are verified (see `qm-usage-decision-source-verification.md` §7).

Replace `<verified_usage_decision_object>` with the actual object name. Replace column names if they differ from V1 assumptions.

```sql
-- Distinct usage decision codes and texts
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
  COUNT(CASE WHEN usage_decision_code = '' THEN 1 END) AS rows_empty_string,
  COUNT(*) - COUNT(usage_decision_code) AS rows_null_code
FROM connected_plant_uat.gold.<verified_usage_decision_object>;

-- Combined code + valuation + quality score distribution (if quality_score column exists)
SELECT
  usage_decision_code,
  valuation_code,
  COUNT(*) AS rows,
  AVG(quality_score) AS avg_quality_score,
  MIN(quality_score) AS min_quality_score,
  MAX(quality_score) AS max_quality_score
FROM connected_plant_uat.gold.<verified_usage_decision_object>
GROUP BY usage_decision_code, valuation_code
ORDER BY rows DESC
LIMIT 100;
```

Capture actual results verbatim in the evidence table in `qm-usage-decision-source-verification.md` §13. Do not remap or interpret the values before capturing them.

---

## 6. Release-Status Mapping Rules

The following mapping rules apply to any display slice that references usage-decision codes:

| Rule | Description |
|---|---|
| **No invented mapping** | Do not assign accepted/released/rejected/conditional/blocked to any code value unless a governed SAP QM mapping is provided in writing by the Kerry Quality/QM process owner |
| **No absence = accepted** | A null or absent usage-decision must never be displayed as accepted, released, or compliant |
| **No valuation heuristic** | V1 broad heuristic `LIKE 'A%' => accepted` must not be promoted to V2 release mapping without explicit governance |
| **No quality_score threshold** | Do not derive release status from quality_score thresholds without a confirmed business rule |
| **No stock proxy** | UNRESTRICTED stock ≠ released; QI HOLD stock ≠ pending UD; BLOCKED stock ≠ rejected |
| **Distinct from SPC** | Control chart status (in control / out of control) is not usage decision status |
| **Distinct from CoA** | CoA-like result evidence is not CoA document approval and is not usage decision |
| **Display source verbatim** | If a code and text are available, show them verbatim first; any V2 interpretation label must be additive and governed |

---

## 7. Governance Checkpoint

Before any usage-decision code mapping is added to V2:

- [ ] The Kerry Quality or QM process owner has confirmed the code-to-release-status mapping in writing.
- [ ] The mapping covers the codes actually observed in the UAT source (§5 evidence).
- [ ] The mapping is recorded in this document in §2 with confidence = `verified` and a governance reference.
- [ ] The V2 display wording is reviewed against the SAP QM spec for consistency.
- [ ] Absent/null usage-decision behaviour is explicitly defined.

Until this checkpoint is complete, V2 must display source code/text only with the `read-only evidence` label.

---

## 8. Backlog Items

| Priority | Item | Notes |
|---|---|---|
| P0 | Run code/text distribution query (§5) and populate §2 table | Prerequisite for any display decision |
| P0 | Obtain governed code mapping from Kerry Quality/QM process owner | Cannot map to release status without governance |
| P1 | Document null/empty code semantics | Missing UD must not equal accepted |
| P1 | Review `VALUATION_CODE` semantics with QM process owner | Different from `USAGE_DECISION_CODE` |
| P2 | Confirm `QUALITY_SCORE` meaning and safe display threshold | Do not use as release proxy |
| P3 | Update this document once governed mapping is confirmed | Single source of truth for V2 code display |
