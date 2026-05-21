# Traceability Production Readiness Checklist

**Domain:** `domain-integrations/traceability`
**Last updated:** 2026-05-20
**Purpose:** Gate criteria that must be satisfied before the traceability investigation cockpit is used for real quality, food-safety, or recall decisions.

Status key: ✅ Done · 🔶 Partial / in progress · ❌ Not done · ⬜ Not applicable

---

## 1. Correctness

| # | Gate | Status | Notes |
|---|------|--------|-------|
| 1.1 | Lineage correctness validated against live Databricks gold views | ❌ | Mock only. See `mb56-parity-review.md`. |
| 1.2 | MB56-style behaviour compared to reference engine | 🔶 | Gap analysis complete (`mb56-parity-review.md`). Live parity not verified. |
| 1.3 | Null/unavailable data states do not imply false containment | ✅ | Fixed PR #24 (null customerExposure → UNKNOWN severity). |
| 1.4 | Severity tiering reflects exposure depth, not only binary shipped flag | 🔶 | Schema/code-ready AND lineage-only first Databricks slice implemented 2026-05-20. `maxExposureDepth` populated from gold_batch_lineage DELIVERY edges. V1-parity delivery view slice (gold_batch_delivery_v) implemented 2026-05-20 on POST /api/trace2/customer-deliveries; 17 columns verified live via DESCRIBE TABLE 2026-05-20 (TRACE-P1-009 fixed). UAT required: confirm live delivery row return for a known shipped batch (DEF-TRACE-006 CD-1 through CD-6). |
| 1.5 | Link types on trace graph edges discriminate vendor receipts from internal moves | 🔶 | Code fixed PR #26 (linkType passthrough, expanded relationshipType enum). Live Databricks LINK_TYPE value validation still required before UAT sign-off. |
| 1.6 | Graph truncation signalled when depth limit is reached | 🔶 | Code fixed: unified truncation banner copy updated; `max_edges_reached` warning now triggers banner alongside `max_depth_reached` and `truncated=true`. Live validation pending (TRACE-P1-001 — code-fixed). |
| 1.7 | `gold_batch_summary_v` column names verified in live Databricks catalog | ✅ | Verified 2026-05-19 against connected_plant_uat. MANUFACTURE_DATE confirmed; SHELF_LIFE_EXPIRATION_DATE replaces expiry_date; PLANT_ID/BATCH_STATUS/UOM/PROCESS_ORDER_ID not in summary_v (sourced from stock_v and gold_material). TODO markers removed from adapter. See `databricks-column-verification-queries.md`. |
| 1.8 | `gold_batch_mass_balance_v` column names verified and route live | 🔶 | All 11 columns verified live 2026-05-20 via DESCRIBE TABLE; `POST /api/trace2/mass-balance` route wired; legacy-api adapter override calls it (TRACE-P1-005 fixed). Two correctness defects opened from live data: TRACE-P1-010 (movement category mapping incomplete — STO Receipt/STO Transfer/Other (NNN) fall through to "adjustment"; surfaced as unresolvedMovements), TRACE-P1-011 (BALANCE_QTY always 0 for UAT candidate — runningBalance semantics need source verification). Panel disclaimer warns users not to treat variance as a verified mass-balance result. |

---

## 2. Evidence Quality

| # | Gate | Status | Notes |
|---|------|--------|-------|
| 2.1 | "Missing evidence" clearly labelled and distinguished from "zero exposure" | ✅ | EvidenceConfidenceBadge + UNKNOWN severity path. |
| 2.2 | Mock data is not presented as live or verified | ✅ | Adapter factory pattern; mock mode explicit. |
| 2.3 | Evidence confidence scoring sectors documented | ✅ | `ScoringRules` section added to `EvidenceConfidenceBadge` tooltip (2026-05-21): lists each sector with point weight and the grade thresholds. TRACE-P2-004 fixed. |
| 2.4 | Data freshness / staleness surfaced to user | 🔶 | Phase 1 expanded (2026-05-21): shared `QueriedAtLabel` component shows "Queried at HH:MM:SS — source refresh time unavailable" on BatchHeaderPanel, TraceGraphPanel, CustomerImpactPanel, MaterialSupplierExposurePanel, MassBalancePanel. Phase 2 (verified `_updated_at` column) remains open in `data-freshness-plan.md`. TRACE-P2-002 status updated. |
| 2.5 | Quality decision source documented and blocked until QM evidence verified | 🔶 | `_derive_quality_status` returns `pending` (QI stock > 0) or `unknown` only. `accepted`/`rejected`/`conditional` require a verified QM usage-decision field (e.g. `gold_qm_usage_decision_v`) that is not in the current query. Tests prove conservative values are enforced. Blocker documented in adapter docstring. Implementation plan in `quality-decision-source-plan.md`. |

---

## 3. UAT Acceptance

| # | Gate | Status | Notes |
|---|------|--------|-------|
| 3.1 | UAT acceptance script written | ✅ | `uat-acceptance-script.md` — 10 scenarios. |
| 3.2 | UAT acceptance script executed against deployed app | ❌ | No browser/UAT access at time of writing. First-run checklist in `uat-validation-ledger.md`. |
| 3.3 | Golden test batches defined | 🔶 | `golden-test-batches.md` exists; only mock fixture validated; reference candidate requires live validation. |
| 3.4 | UAT validation ledger entries complete for ≥ 1 live batch | ❌ | `uat-validation-ledger.md` created; no live runs recorded. SQL validation pack: `docs/migration/traceability-first-live-validation-sql.md`. API smoke test: `docs/migration/traceability-first-live-api-smoke-test.md`. |
| 3.5 | All P0 defects resolved or risk-accepted before UAT sign-off | ❌ | TRACE-P0-002 code fixed (PR #26), live validation pending. TRACE-P0-003 open. |

---

## 4. Tests

| # | Gate | Status | Notes |
|---|------|--------|-------|
| 4.1 | All existing tests passing on CI | ✅ | TypeScript: 229 tests (di-traceability, +5 mass-balance adapter tests). Python: 270 tests (adapter + route, +18 mass-balance tests). |
| 4.1 | All existing tests passing on CI | ✅ | TypeScript: 250 tests (di-traceability, +14 for QueriedAtLabel, ScoringRules, per-link-type edge stroke, raw linkType in edge detail). Python: 252 tests (unchanged in this PR — graph/freshness/confidence work is UI-only). |
| 4.2 | Null/unknown data states covered by unit tests | ✅ | `InvestigationSummary.test.tsx` — 4 null-path tests added PR #24. |
| 4.3 | Evidence confidence scoring edge cases tested | ✅ | `EvidenceConfidence.test.tsx` — COMPLETE / PARTIAL / UNKNOWN cases. |
| 4.4 | Adapter error states (`ok: false`) tested across all panels | 🔶 | Legacy adapter tested; panel-level `displayState` handling not systematically tested. |
| 4.5 | Graph mapper null/empty input handling tested | ✅ | `trace2-graph-mapper.test.ts` exists. |

---

## 5. Security & Identity

| # | Gate | Status | Notes |
|---|------|--------|-------|
| 5.1 | Databricks reads use authenticated end-user OAuth identity | ❌ | Not verified — go-live prerequisite. OAuth header passthrough (`x-forwarded-access-token`) is implemented in `identity.py` but has not been validated against a live Databricks Apps deployment. See Unity Catalog prerequisite doc. |
| 5.2 | No service-principal fallback for user-facing reads | ❌ | Not verified — go-live prerequisite. Code prohibits SP fallback by design (CLAUDE.md constraint); must be confirmed in deployed environment before any production use. |
| 5.3 | No hardcoded warehouse IDs, tokens, or workspace URLs in source | ✅ | No instances found in `domain-integrations/traceability/src/`. |

---

## 5a. Unity Catalog Authorization Prerequisites

These gates must be satisfied before the databricks-api adapter is activated for any user-facing data access. Unity Catalog is the intended data-authorization enforcement layer; no app-side plant entitlement lists will be implemented.

| # | Gate | Status | Notes |
|---|------|--------|-------|
| UC-1 | Gold views registered in Unity Catalog with row/column security policies | ❌ | Prerequisite for any live Databricks read. Must be completed by data platform team before app activation. |
| UC-2 | End-user AAD identities federated into Databricks workspace | ❌ | Required so OAuth token from `x-forwarded-access-token` resolves to a UC principal with correct grants. |
| UC-3 | UC grants scoped to minimum required views (principle of least privilege) | ❌ | Grant model must be defined and reviewed before go-live. |
| UC-4 | OAuth header forwarding validated in live Databricks Apps deployment | ❌ | `identity.py` implementation is assumed-correct; must be verified end-to-end in deployed environment. |
| UC-5 | Data access audit log confirmed active for gold view reads | ❌ | Required for food-safety and recall audit trail. Confirm Unity Catalog audit logging enabled before production use. |

---

## 6. Deployment

| # | Gate | Status | Notes |
|---|------|--------|-------|
| 6.1 | Databricks Apps `app.yaml` secret syntax validated (plain `scope/key` string, not nested dict) | ⬜ | Not applicable until app.yaml configured for this domain. |
| 6.2 | Rollback procedure documented | ❌ | Not yet documented. |
| 6.3 | Performance limits documented (max graph depth, node count, query timeout) | ❌ | No performance limits documented. |

---

## 7. Documentation & i18n

| # | Gate | Status | Notes |
|---|------|--------|-------|
| 7.1 | Domain README exists | ✅ | Fixed PR #25 — README.md added to `domain-integrations/traceability/`. |
| 7.2 | API / adapter contract documented | 🔶 | Adapter types are self-documenting via TypeScript; no prose API doc. |
| 7.3 | i18n coverage complete for all user-facing strings | ❌ | All strings are hardcoded English inline styles. i18n not implemented. |
| 7.4 | Defect backlog current | ✅ | `traceability-defect-backlog.md` — 10 items classified. |
| 7.5 | MB56 parity gap analysis current | ✅ | `mb56-parity-review.md` — 5 gaps documented. |
| 7.6 | V1→V2 functional parity matrix current | ✅ | `traceability-v1-v2-functional-parity.md` — 27 capabilities assessed; ranked P0/P1 gaps documented. |

---

## Readiness Summary

| Phase | Verdict |
|-------|---------|
| Development / code review | ✅ Ready |
| Internal mock-mode demonstration | ✅ Ready |
| UAT with live Databricks data | ❌ Blocked — depth severity and column verification require live data; no live validation performed |
| Production / recall decision support | ❌ Blocked — requires UAT sign-off, P0 population from live data, OAuth wiring |
