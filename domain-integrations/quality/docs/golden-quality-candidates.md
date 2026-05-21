# Golden Quality Candidates

**Status:** candidate template and discovery ledger.
**Last updated:** 2026-05-21.

No verified live Quality UAT candidate has been identified from V1 discovery.

The existing V2 mock release cases in `golden-quality-batches.md` remain useful for UI trust-hardening tests only. They must not be treated as live SAP QM or release evidence.

## Candidate Template

| Field | Value |
|---|---|
| plantId | TBD |
| materialId | TBD |
| batchId | TBD |
| inspectionLotId | TBD |
| processOrderId | TBD, if relevant |
| usageDecisionCode | TBD, if known |
| usageDecisionText | TBD, if known |
| releaseStatus | Unknown until source-backed |
| MIC/result count | TBD, if known |
| CoA status | Unknown until document/result source validated |
| deviation count | Unknown until deviation/notification source validated |
| source views | TBD |
| expected warnings | Missing evidence must not be interpreted as accepted/released/no issue |
| validation status | Not identified |
| evidence captured by | TBD |
| evidence captured at | TBD |

## Candidate Evidence Rules

- Do not invent expected counts.
- Do not infer accepted/released from missing usage-decision data.
- Do not infer no deviations from missing deviation rows.
- Distinguish SAP QM usage decision, quality result valuation, stock status, lab approval, and CoA evidence.
- Record exact source views and route/query evidence when a candidate is selected.
