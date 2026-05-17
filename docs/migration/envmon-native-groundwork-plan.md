# EnvMon Native Databricks Groundwork Plan

**Date:** 2026-05-17
**Tranche:** i.txt
**Status:** GROUNDWORK COMPLETE — no implementation; source confidence zero
**Outcome:** All native implementation deferred. Domain owner must identify LIMS→Databricks gold views before any QuerySpec or route work can proceed.

---

## Purpose

Records the findings of the EnvMon native Databricks groundwork tranche (i.txt). The goal was to audit the existing EnvMon module, inventory data contracts, identify candidate Databricks source views, and rank first native slices.

No implementation was done. No QuerySpecs, no routes, no code changes. Source confidence is zero — no gold views have been confirmed or even tentatively identified from repo code or docs.

---

## Current State (2026-05-17)

| Item | Status |
|---|---|
| Adapter methods | 9 — all mock-only |
| FastAPI routes | None |
| Databricks QuerySpecs | None |
| Source system | LIMS (mock in Phase 4 — not yet in gold layer, or gold views unidentified) |
| Gold views confirmed | **Zero** |
| Gold views tentatively identified | **Zero** |
| Legacy-api adapter | None |
| Groundwork docs | Complete (see below) |

---

## What Was Audited

| Artefact | Finding |
|---|---|
| `domain-integrations/envmon/src/adapters/envmon-adapter.ts` | 9 mock-only methods; no Databricks imports; no QuerySpec |
| `packages/data-contracts/src/schemas/environmental-monitoring.ts` | 10 contract types defined; 3 key enums |
| `domain-integrations/envmon/src/panels/` | 8 panels; all `sourceOwnership: { systemName: 'lims' }` |
| `docs/product-model/envmon-monitoring.md` | lifecycle: live; 7 views; 8 panels; source described as LIMS |
| `docs/audit/domain-source-truth-matrix.md` §7 | "No gold views confirmed. No planning path identified." |
| `apps/api/routes/` | No EnvMon routes (auth, cq, health, por, trace2, wh360, workspaces only) |

---

## Key Findings

**Finding 1 — Source system is LIMS, not SAP.**
EnvMon data originates from a LIMS (Laboratory Information Management System), not SAP ECC/S4. This is a different integration from POH (`csm_process_order_history`) and CQ (`gold`). The Databricks gold layer may expose LIMS data via views not yet identified in this repo.

**Finding 2 — Zero gold views identified.**
No EnvMon-specific gold views, MVs, or tables were found in repo code, docs, or audit matrices. The candidates in `docs/audit/envmon-databricks-source-candidates.md` are entirely speculative — inferred from the i.txt §3 concept list and common LIMS/quality data patterns. None are confirmed by DDL or code.

**Finding 3 — Panel source badge shows "lims" to users.**
All 8 panels register `sourceOwnership: { domainId: 'envmon', systemName: 'lims', legacyAppId: 'lims' }`. This is static metadata (not a runtime API response field), but the EvidencePanel component renders `systemName` as the source badge visible to users. When the source moves to Databricks, this registration will need updating in each panel.

**Finding 4 — No legacy-api adapter exists.**
Unlike POH and CQ Lab, there is no `EnvMonLegacyApiAdapter`. There is no V1 proxy path to validate against. Native Databricks will be the first live data path for EnvMon if/when implemented.

**Finding 5 — 10 contract types defined, none mapped to source columns.**
The Zod schemas in `environmental-monitoring.ts` define a rich model (zones, hygiene zones, swab results, heatmap cells, trends, corrective actions, vectors, KPIs). None can be mapped to Databricks columns until source views are confirmed.

---

## What Is Needed to Unblock

In order:

1. **Domain owner identifies LIMS gold views** — which Databricks Unity Catalog schema/view exposes environmental monitoring data? (catalog, schema, view name)
2. **Run `DESCRIBE TABLE` on identified views** — confirm column names, types, and availability
3. **Update `docs/audit/envmon-native-column-verification-checklist.md`** — mark columns `confirmed-ddl`
4. **Run `SELECT DISTINCT` on key categorical columns** — confirm enum values match contract (`hygieneZone`, `areaType`, `result`)
5. **Map contract fields to confirmed columns** — update `docs/audit/envmon-contract-inventory.md`
6. **Implement QuerySpec for highest-ranked confirmed candidate** — only after steps 1–5

---

## Groundwork Documents Created (i.txt)

| Document | Purpose |
|---|---|
| `docs/domains/envmon-monitoring.md` | Adapter/contract/source angle — links to product model |
| `docs/audit/envmon-contract-inventory.md` | Per-method: adapter method, contract type, fields, filters, source badge |
| `docs/audit/envmon-databricks-source-candidates.md` | Speculative source candidates — all unconfirmed |
| `docs/audit/envmon-native-column-verification-checklist.md` | DDL SQL to run — all items unchecked |
| `docs/migration/envmon-native-candidate-ranking.md` | Ranked first slices — all BLOCKED |
| `docs/audit/envmon-native-architecture-check.md` | Architecture guardrail check |

---

## Recommended First Step (Post-Groundwork)

Contact the EnvMon domain owner or data engineering team:

> "Which Databricks Unity Catalog view exposes LIMS environmental monitoring results — sampling points, test results, hygiene zones — for plant C061 and other connected sites? We need the catalog name, schema name, and view/table name to run DDL verification."

Once a view is named, run `DESCRIBE TABLE` and work through `docs/audit/envmon-native-column-verification-checklist.md`.

Do not implement any QuerySpec or route before step 1 above is answered.
