# Quality Batch Release Production Readiness Checklist

**Domain:** `domain-integrations/quality`
**Last updated:** 2026-05-19
**Purpose:** Gate criteria that must be satisfied before the quality batch release cockpit is used for real release decisions or operational coordination.

Status key: ✅ Done · 🔶 Partial / in progress · ❌ Not done · ⬜ Not applicable

---

## 1. Correctness

| # | Gate | Status | Notes |
|---|------|--------|-------|
| 1.1 | Integration status banner visible on all views | ✅ | Renders `VerificationStatusBanner` in `BatchReleaseWorkspace.tsx` showing hybrid integration mode. |
| 1.2 | Advisory tone enforced in all alerts/warnings | ✅ | Footnotes added to summary, deviations, results, and CoA readiness panels to clarify that release actions are simulated and data is read-only. |
| 1.3 | Mixed-mode execution boundaries clearly defined | ✅ | Only Lab Board views are mapped to legacy V1 APIs; all other panels are simulated via mock adapters. |
| 1.4 | Null or missing data does not mask active defect status | ✅ | If an adapter fails or returns an error result, the wrapper `EvidencePanel` handles the error/loading states and does not assume a passing default. |

---

## 2. Evidence Quality

| # | Gate | Status | Notes |
|---|------|--------|-------|
| 2.1 | Data source attribution (mock vs. legacy API) returned by all adapters | ✅ | All quality adapters explicitly return `source: 'mock'` on mock paths and `source: 'legacy-api'` on legacy paths. |
| 2.2 | Data source attribution visible in UI | ✅ | All 9 panels forward the `source` prop from the query hook results to `<EvidencePanel>` to render dynamic source badges. |
| 2.3 | Freshness policies declared and respected | 🔶 | Freshness policy declared in panel registrations; underlying SAP QM / CoA / usage-decision data freshness is not validated for mock release panels and live freshness is not surfaced. |

---

## 3. UAT Acceptance

| # | Gate | Status | Notes |
|---|------|--------|-------|
| 3.1 | Golden test batches and release cases defined | ✅ | Documented in `golden-quality-batches.md` for both mock and hybrid scenarios. |
| 3.2 | UAT acceptance testing conducted for Lab Board view | ❌ | Backend proxy endpoints wired, but live E2E browser tests are pending staging environment deployment. |
| 3.3 | Quality release actions validated in SAP QM test environment | ❌ | Release actions are currently read-only simulation. SAP write-back integration is out of scope for Phase 2. |

---

## 4. Tests

| # | Gate | Status | Notes |
|---|------|--------|-------|
| 4.1 | Adapter contract tests cover mock data structures | ✅ | Schema correctness verified using Zod schemas from `@connectio/data-contracts`. |
| 4.2 | Panel component tests cover query states (loading, ready, error) | ✅ | Existing Vitest suites run and verify basic rendering. |
| 4.3 | Test coverage meets or exceeds 60% threshold | ✅ | `di-quality` test suites validated locally. |

---

## 5. Security & Identity

| # | Gate | Status | Notes |
|---|------|--------|-------|
| 5.1 | User OAuth identity enforced for Databricks data-access | ⬜ | Not applicable. Databricks-API mode is not yet implemented or wired for the Quality domain. |
| 5.2 | No service-principal fallback paths implemented | ✅ | Any future Databricks integration must block on identity controls rather than using app-side fallbacks. |
| 5.3 | Secret-scope environment variables used for proxy base URLs | ✅ | Frontend references FastAPI proxy, backend references secret-scoped environment variables. |

---

## 6. Deployment

| # | Gate | Status | Notes |
|---|------|--------|-------|
| 6.1 | Rollback plan established | ❌ | To be defined by deployment engineering. |
| 6.2 | Mock mode disabled in production builds | 🔶 | Deployment convention documented; production enforcement not yet proven. Production deployment must explicitly disallow mock mode or fail readiness checks before operational use. |

---

## 7. Documentation

| # | Gate | Status | Notes |
|---|------|--------|-------|
| 7.1 | Domain integration README exists | ✅ | Documented under `domain-integrations/quality/README.md`. |
| 7.2 | UAT Candidate ledger created | ✅ | Documented under `domain-integrations/quality/docs/golden-quality-batches.md`. |
| 7.3 | Known limitations document created | ✅ | Documented under `domain-integrations/quality/docs/quality-known-limitations.md`. |
| 7.4 | UAT Acceptance script created | ✅ | Documented under `domain-integrations/quality/docs/quality-uat-acceptance-script.md`. |

---

## Readiness Summary

| Phase | Verdict |
|-------|---------|
| Development / Code Review | ✅ Ready |
| Internal Mock-Mode Demonstration | ✅ Ready |
| UAT with Live Backend Data | ❌ Blocked — requires staging deployment, SAP QM write-back verification, and Databricks scope enablement. |
| Production Go-Live | ❌ Blocked — requires UAT sign-off and Databricks security integration. |
