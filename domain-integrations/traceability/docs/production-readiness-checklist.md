# Traceability Production Readiness Checklist

**Domain:** `domain-integrations/traceability`
**Last updated:** 2026-05-19
**Purpose:** Gate criteria that must be satisfied before the traceability investigation cockpit is used for real quality, food-safety, or recall decisions.

Status key: ✅ Done · 🔶 Partial / in progress · ❌ Not done · ⬜ Not applicable

---

## 1. Correctness

| # | Gate | Status | Notes |
|---|------|--------|-------|
| 1.1 | Lineage correctness validated against live Databricks gold views | ❌ | Mock only. See `mb56-parity-review.md`. |
| 1.2 | MB56-style behaviour compared to reference engine | 🔶 | Gap analysis complete (`mb56-parity-review.md`). Live parity not verified. |
| 1.3 | Null/unavailable data states do not imply false containment | ✅ | Fixed PR #24 (null customerExposure → UNKNOWN severity). |
| 1.4 | Severity tiering reflects exposure depth, not only binary shipped flag | ❌ | TRACE-P0-003 open. |
| 1.5 | Link types on trace graph edges discriminate vendor receipts from internal moves | ❌ | TRACE-P0-002 open. |
| 1.6 | Graph truncation signalled when depth limit is reached | ❌ | TRACE-P1-001 open. |

---

## 2. Evidence Quality

| # | Gate | Status | Notes |
|---|------|--------|-------|
| 2.1 | "Missing evidence" clearly labelled and distinguished from "zero exposure" | ✅ | EvidenceConfidenceBadge + UNKNOWN severity path. |
| 2.2 | Mock data is not presented as live or verified | ✅ | Adapter factory pattern; mock mode explicit. |
| 2.3 | Evidence confidence scoring sectors documented | 🔶 | Score logic documented in code; user-facing explanation missing (TRACE-P2-004). |
| 2.4 | Data freshness / staleness surfaced to user | ❌ | TRACE-P2-002 open. |

---

## 3. UAT Acceptance

| # | Gate | Status | Notes |
|---|------|--------|-------|
| 3.1 | UAT acceptance script written | ✅ | `uat-acceptance-script.md` — 10 scenarios. |
| 3.2 | UAT acceptance script executed against deployed app | ❌ | No browser/UAT access at time of writing. |
| 3.3 | Golden test batches defined | 🔶 | `golden-test-batches.md` exists; only mock fixture validated; reference candidate requires live validation. |
| 3.4 | UAT validation ledger entries complete for ≥ 1 live batch | ❌ | `uat-validation-ledger.md` created; no live runs recorded. |
| 3.5 | All P0 defects resolved or risk-accepted before UAT sign-off | ❌ | TRACE-P0-002 and TRACE-P0-003 open. |

---

## 4. Tests

| # | Gate | Status | Notes |
|---|------|--------|-------|
| 4.1 | All existing tests passing on CI | ✅ | `pnpm nx test di-traceability` passes (163 tests). |
| 4.2 | Null/unknown data states covered by unit tests | ✅ | `InvestigationSummary.test.tsx` — 4 null-path tests added PR #24. |
| 4.3 | Evidence confidence scoring edge cases tested | ✅ | `EvidenceConfidence.test.tsx` — COMPLETE / PARTIAL / UNKNOWN cases. |
| 4.4 | Adapter error states (`ok: false`) tested across all panels | 🔶 | Legacy adapter tested; panel-level `displayState` handling not systematically tested. |
| 4.5 | Graph mapper null/empty input handling tested | ✅ | `trace2-graph-mapper.test.ts` exists. |

---

## 5. Security & Identity

| # | Gate | Status | Notes |
|---|------|--------|-------|
| 5.1 | Databricks reads use authenticated end-user OAuth identity | ⬜ | Not applicable until live Databricks mode activated. |
| 5.2 | No service-principal fallback for user-facing reads | ⬜ | Not applicable until live Databricks mode activated. |
| 5.3 | No hardcoded warehouse IDs, tokens, or workspace URLs in source | ✅ | No instances found in `domain-integrations/traceability/src/`. |

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
| 7.1 | Domain README exists | ❌ | TRACE-P1-002 open. |
| 7.2 | API / adapter contract documented | 🔶 | Adapter types are self-documenting via TypeScript; no prose API doc. |
| 7.3 | i18n coverage complete for all user-facing strings | ❌ | All strings are hardcoded English inline styles. i18n not implemented. |
| 7.4 | Defect backlog current | ✅ | `traceability-defect-backlog.md` — 10 items classified. |
| 7.5 | MB56 parity gap analysis current | ✅ | `mb56-parity-review.md` — 5 gaps documented. |

---

## Readiness Summary

| Phase | Verdict |
|-------|---------|
| Development / code review | ✅ Ready |
| Internal mock-mode demonstration | ✅ Ready |
| UAT with live Databricks data | ❌ Blocked — P0 defects open, no live validation performed |
| Production / recall decision support | ❌ Blocked — requires UAT sign-off, P0 resolution, OAuth wiring |
