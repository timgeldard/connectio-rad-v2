# Next Action Plan — Post Main-Sync Readiness

**Date:** 2026-05-21
**Branch basis:** `main` after PR #61 (QM UD source verification) and PR #62 (POH hardening)
**Related:** `current-main-readiness-review.md`

This plan defines the recommended next order of work after the post-merge readiness sync. It clearly separates developer tasks from Databricks-enabled validation and business governance work. It does not propose broad feature expansion before validation is complete.

---

## Action Plan

### Action 1 — Run Traceability UAT Evidence Runbook

| Field | Value |
|---|---|
| Owner type | QA / developer with deployed UAT environment access |
| Databricks access required | Yes — deployed app must run in `databricks-api` mode |
| Business owner required | No (initially) — purely technical evidence capture |
| Expected output | Filled-in `traceability-uat-evidence-runbook.md`; UAT run table row in `uat-validation-ledger.md`; screenshots per panel |
| Blocked by | Deployed Databricks Apps environment with OAuth and `databricks-api` adapter mode |
| Risk if skipped | No evidence that live Databricks routes return correct data; cannot claim any live parity; DEF-TRACE-005 (LINK_TYPE) and TRACE-P1-010/011 remain uninvestigated in browser |

**Runbook:** `domain-integrations/traceability/docs/traceability-uat-evidence-runbook.md`
**Candidate batch:** material `20035129` / batch `8000049668` / plant `C061`

---

### Action 2 — Run POH UAT Evidence Runbook

| Field | Value |
|---|---|
| Owner type | QA / developer with deployed UAT environment access |
| Databricks access required | Yes — all 4 POH routes require native Databricks execution |
| Business owner required | No (initially) |
| Expected output | Filled-in `poh-uat-evidence-runbook.md`; screenshots per section; component consumption rows captured showing material + batch + UOM |
| Blocked by | Deployed environment; confirmed `databricks-api` adapter mode for POH |
| Risk if skipped | PR #62 component consumption fix cannot be confirmed as working correctly in live mode; source attribution cannot be validated |

**Runbook:** `domain-integrations/operations/docs/poh-uat-evidence-runbook.md`
**Candidate:** process order `7006965038`, plant `C113`

---

### Action 3 — Resolve Mass Balance MOVEMENT_CATEGORY Mapping (TRACE-P1-010)

| Field | Value |
|---|---|
| Owner type | Data platform engineer or business analyst with SAP MM knowledge |
| Databricks access required | No (governance decision); Yes for SQL verification |
| Business owner required | Yes — direction assignment requires business / data-platform confirmation |
| Expected output | All rows in the approval table in `mass-balance-movement-category-register.md` filled in; `_MOVEMENT_CATEGORY_MAP` in backend updated; TRACE-P1-010 closed |
| Blocked by | Data-platform or business owner availability; decision on QUANTITY sign semantics |
| Risk if skipped | Mass balance panel continues to show incomplete category mapping caveat; balance figures cannot be trusted for any investigative conclusion |

**Pack:** `domain-integrations/traceability/docs/mass-balance-semantic-validation-pack.md`

---

### Action 4 — Resolve BALANCE_QTY Semantics (TRACE-P1-011)

| Field | Value |
|---|---|
| Owner type | Data platform engineer |
| Databricks access required | Yes — spot-check across multiple batches required |
| Business owner required | No (technical clarification) |
| Expected output | All rows in `BALANCE_QTY Decision Table` in `mass-balance-semantic-validation-pack.md` filled in; V2 display updated (either use confirmed column or compute own balance); TRACE-P1-011 closed |
| Blocked by | Data platform availability; depends on QUANTITY sign clarity from Action 3 |
| Risk if skipped | `runningBalance` in mass balance panel remains untrustworthy; panel caveat cannot be removed |

---

### Action 5 — Confirm Lot-Selection Rule for QM UD Batch-Level Display

| Field | Value |
|---|---|
| Owner type | Kerry QM process owner |
| Databricks access required | No (governance decision) |
| Business owner required | Yes — which inspection lot is authoritative when a batch has multiple? |
| Expected output | Written confirmation of lot-selection rule; §6 of `qm-usage-decision-runtime-implementation-plan.md` updated; "go" issued for batch-level UD wiring |
| Blocked by | QM process owner availability; may also require data-platform to confirm whether multiple lots per batch are common |
| Risk if skipped | Batch-level UD evidence display cannot be safely wired; per-lot display is possible without this rule but requires explicit multi-lot UI |

---

### Action 6 — Run SPC Databricks Verification Pack

| Field | Value |
|---|---|
| Owner type | Developer with Databricks access |
| Databricks access required | Yes — pack contains SQL templates for 7 gold view objects |
| Business owner required | No |
| Expected output | All evidence tables in `spc-databricks-source-verification.md` filled in; `golden-spc-candidates.md` updated with confirmed UAT candidates; `spc-native-migration-readiness-checklist.md` items checked off |
| Blocked by | Databricks access; V1 SPC app URL must be confirmed as accessible in UAT workspace |
| Risk if skipped | No native SPC implementation can proceed safely; column names, grain, and data model remain unconfirmed |

**Pack:** `domain-integrations/spc/docs/spc-databricks-source-verification.md`

---

### Action 7 — Wire QM UD Read-Only Display (after Actions 5 and 6 gates pass)

| Field | Value |
|---|---|
| Owner type | Developer |
| Databricks access required | Yes — live route execution requires UAT environment |
| Business owner required | No (if lot-selection rule already confirmed in Action 5) |
| Expected output | Native `POST /api/quality/usage-decision` route; read-only display in Quality Evidence view; per-lot evidence table; governed labels from code mapping; all tests passing |
| Blocked by | Action 5 (lot-selection rule); Unity Catalog grants for `gold_inspection_usage_decision` + `gold_inspection_lot`; latest-row SQL template validated against live data |
| Risk if skipped | UD evidence remains mock-only in Quality and Traceability views |

**Plan:** `domain-integrations/quality/docs/qm-usage-decision-runtime-implementation-plan.md`

---

### Action 8 — Run Quality Broader Source Verification Pack

| Field | Value |
|---|---|
| Owner type | Developer with Databricks access |
| Databricks access required | Yes — pack covers inspection-lot, MIC result, specification, CoA-like, and deviation objects |
| Business owner required | No |
| Expected output | Evidence tables in `quality-databricks-source-verification.md` filled in; golden quality candidates updated |
| Blocked by | Databricks access |
| Risk if skipped | Quality read-only MIC/CoA/deviation display cannot be safely wired; column names and grain unconfirmed |

---

### Action 9 — Confirm `gold_supplier` Object and Grants for Supplier Exposure

| Field | Value |
|---|---|
| Owner type | Data platform engineer |
| Databricks access required | Yes — catalog resolver check |
| Business owner required | No |
| Expected output | Object name confirmed; Unity Catalog grant confirmed; supplier exposure live slice can be planned |
| Blocked by | Data platform availability |
| Risk if skipped | Supplier exposure remains mock-only indefinitely |

---

### Action 10 — Warehouse Source Schema Alignment

| Field | Value |
|---|---|
| Owner type | Developer with Databricks access |
| Databricks access required | Yes |
| Business owner required | No (initially) |
| Expected output | Missing columns and views identified; warehouse migration audit updated; at least one route browser-verified |
| Blocked by | Databricks access; lower priority than Actions 1–5 |
| Risk if skipped | Warehouse360 remains trust-hardened but source-unverified |

---

## Summary Matrix

| # | Action | Dev task | Databricks needed | Business owner needed | Priority |
|---|---|---|---|---|---|
| 1 | Traceability UAT runbook | Yes | Yes | No | P0 |
| 2 | POH UAT runbook | Yes | Yes | No | P0 |
| 3 | Mass balance direction mapping | No | Optional | Yes | P1 |
| 4 | BALANCE_QTY semantics | Yes | Yes | No | P1 |
| 5 | UD lot-selection rule | No | No | Yes | P1 |
| 6 | SPC Databricks verification pack | Yes | Yes | No | P2 |
| 7 | Wire QM UD read-only display | Yes | Yes | No | P2 (after 5) |
| 8 | Quality broader source pack | Yes | Yes | No | P2 |
| 9 | `gold_supplier` grants | No | Yes | No | P2 |
| 10 | Warehouse schema alignment | Yes | Yes | No | P3 |

---

## What NOT to Do Next

- Do not add new live Databricks routes before Action 1 and 2 evidence is captured.
- Do not expand SPC before the verification pack (Action 6) is executed.
- Do not wire UD batch-level display before the lot-selection rule (Action 5) is confirmed.
- Do not implement Quality release/reject actions, e-signature, or SAP QM write-back — these are out of scope for the current phase.
- Do not claim production readiness for any domain until live UAT evidence is captured and reviewed.
