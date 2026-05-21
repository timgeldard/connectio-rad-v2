# Cross-Domain Readiness Index & Navigation Layer

*   [UX Truthfulness Checklist](./ux-truthfulness-checklist.md)

**Date:** 2026-05-20  
**Status:** Living Document  
**Target Audience:** Product Owners, Architects, and UAT Leads  

---

## 1. Purpose

This document serves as a central registry and navigation layer for the ConnectIO RAD V2 application's readiness state. It aggregates information from all domain-specific readiness checklists, UAT validation scripts, and audit reports to provide stakeholders with a transparent, consolidated view of which domains are mock/demo ready, which are ready for live User Acceptance Testing (UAT), and what blockers must be resolved before production deployment.

---

## 2. Status Key

We use the following conservative status classifications:

* **`✅ Ready / complete`** — Feature/domain is fully integrated with live backends, verified in the deployed UAT environment, and matches reference systems.
* **`🔶 Partial / code-ready / mock-ready`** — Code is written and adapter is mock-backed, or is wired to live endpoints but awaiting browser validation or catalog configuration.
* **`❌ Blocked / not yet validated`** — Feature is blocked by database schema unalignment, lack of data source, or missing credentials.
* **`⬜ Not applicable`** — Scoped out of the current phase or integration target.

---

## 3. Domain Summary Table

| Domain | Mock/demo readiness | Live UAT readiness | Production readiness | Main blocker | Key docs / Navigation |
|---|---|---|---|---|---|
| **Traceability** | ✅ | ❌ | ❌ | Live Databricks validation, gold view verification, and UC/OAuth end-to-end evidence. | [Traceability Detail](#traceability) |
| **SPC** | ✅ | ❌ | ❌ | V1 SPC source discovered in `connected_plant_uat.gold` but V2 not yet mapped to it. Blocker is not absent data — it is unmapped V1 source model (material-centric, client-side rule computation, different locked-limits schema). | [SPC Detail](#spc) |
| **Process Order History (POH)** | 🔶 | 🔶 | ❌ | Browser/live validation of the HTTP/UI layer; date controls implementation. | [Process Order History Detail](#process-order-history-poh--operations) |
| **Warehouse360** | 🔶 | ❌ | ❌ | Warehouse360 source-view/schema alignment requires live UAT verification. | [Warehouse360 Detail](#warehouse360) |
| **Quality Batch Release** | 🔶 | ❌ | ❌ | Mock release panels; no live SAP QM usage-decision/write-back/e-signature. | [Quality Detail](#quality-batch-release) |
| **Environmental Monitoring (EnvMon)** | ✅ | 🔶 | ❌ | Databricks/API wired; browser/live UAT evidence should be confirmed from existing migration docs. | [EnvMon Detail](#environmental-monitoring-envmon) |
| **Maintenance & Reliability** | 🔶 | ❌ | ❌ | No gold views identified; SAP PM data-access contracts not signed. | [Maintenance Detail](#maintenance-and-reliability) |
| **Production Staging** | 🔶 | ❌ | ❌ | No gold views confirmed; WMS source views not identified. | [Production Staging Detail](#production-staging) |

---

## 3A. Cross-Domain Genie / Natural-Language Analytics

* **Status:** Discovery complete; implementation intentionally deferred.
* **Summary:**
  * A repo-wide V1 inventory confirms explicit Genie support in the V1 platform shell, POH, Trace2, and SPC.
  * V2 now has shipped **deterministic domain-scoped pilot surfaces** for POH and Traceability in `domain-integrations/`, but it still has **no live Databricks Genie runtime** and no shell-wide assistant.
  * POH is the strongest future parity candidate because V1 preserves a source-controlled semantic pack (`space.yaml`, glossary, rules, joins, expressions, and sample SQL).
  * The current pilots are intentionally narrow, cite loaded evidence panels, and refuse blocked topics instead of inferring beyond approved scope.
  * A V2 shell-wide assistant should remain blocked until domain-level packs are validated and source-truthful.
* **Document Registry:**
  * [Genie Readiness Index](../migration/genie-readiness-index.md) ← **new**
  * [V1 Genie Discovery and V2 Parity Roadmap](../migration/v1-genie-discovery-and-v2-parity-roadmap.md) ← **new**
  * [POH Genie Readiness Pack](../../domain-integrations/operations/docs/poh-genie-readiness-pack.md) ← **new**
  * [Traceability Genie Readiness Pack](../../domain-integrations/traceability/docs/traceability-genie-readiness-pack.md) ← **new**
  * [V2 Shell Genie Decision Record](../migration/v2-shell-genie-decision-record.md) ← **new**

## 4. Domain-by-Domain Detail

### Traceability

* **Status:** Hybrid (Mock / Databricks API).
* **Summary:**
  * Has a strong, high-fidelity mock/demo cockpit supporting trace investigation.
  * A deterministic **Trace Assistant Pilot** now exists as a dedicated workspace view limited to focal batch summary and the currently visible trace graph.
  * Evidence confidence badge logic is fully implemented to display complete, partial, or unknown levels.
  * Resolved the null customer exposure vulnerability (binary severity fallback to `UNKNOWN` instead of defaulting to a false containment/safe state).
  * Edge relationship link types are code-ready, allowing UI to discriminate vendor receipts from internal moves.
  * Depth-aware severity schema is code-ready (incorporating `maxExposureDepth` on frontend).
  * Unified graph truncation banner is code-ready, showing warnings when `max_depth_reached` or `max_edges_reached` is triggered.
  * **Batch header stock bucket breakdown implemented (2026-05-20, PR#50):** Individual UNRESTRICTED, BLOCKED, QI HOLD, RESTRICTED, and TRANSIT quantities now surfaced from `gold_batch_stock_v` (all columns confirmed live 2026-05-19). Blocked and QI Hold quantities are highlighted when non-zero. Live browser validation still pending.
  * **Batch header is now plant-aware (2026-05-20, PR#50):** `plant_id` forwarded from the form to the batch-header SQL WHERE clause, eliminating multi-plant row ambiguity for UAT flows that include a plant.
  * **Both-direction graph retrieval safer (2026-05-20, PR#50):** `direction=both` splits the edge budget evenly between downstream and upstream (max_edges // 2 per direction) so dense downstream results cannot starve upstream rows before the Python truncation cap applies.
  * **Graph direction now preserved in frontend contract (2026-05-20, PR#50):** `mapBackendTraceGraph` reads `direction`, `upstreamCount`, `downstreamCount`, and `unresolvedNodeCount` from the backend response rather than always defaulting to `both`.
  * **Quality unknown state is now explicitly warned (2026-05-20, PR#50):** `BatchHeaderPanel` shows a visible note when `qualityStatus === 'unknown'` stating that unknown must not be interpreted as accepted or rejected.
  * **V1→V2 parity matrix completed (2026-05-20):** 27 V1 capabilities assessed. Key remaining P0 gaps: quality usage-decision source (source-blocked), edge LINK_TYPE live validation. **Production recall readiness is not claimed.**
  * **Customer exposure lineage-only first slice implemented (2026-05-20):** `POST /api/trace2/customer-exposure` route wired to `gold_batch_lineage` downstream CTE. Preliminary exposure-depth indicator only — not V1-parity customer delivery evidence. `deliveryEvidenceSource='lineage'` set on responses. Panel shows "Lineage-only exposure indicator" label.
  * **V1-parity customer delivery slice implemented (2026-05-20):** `POST /api/trace2/customer-deliveries` wired to `gold_batch_delivery_v` (no plant filter — recall coverage requires all plants). Returns `affectedCustomers`, `affectedDeliveries`, `shippedQuantity`, `countries` (from `COUNTRY_ID`). `deliveryEvidenceSource='inventory-movements'`. WHERE key column names (MATERIAL_ID/BATCH_ID) pending DESCRIBE TABLE confirmation — see DEF-TRACE-006/TRACE-P1-009.
  * **UAT Blockers:**
    * Live Databricks UAT is blocked: no live E2E validation against UAT databases has occurred.
    * Column names in `gold_batch_summary_v` confirmed (2026-05-19); `gold_batch_mass_balance_v` WHERE filter columns still unverified.
    * Unity Catalog, OAuth token forwarding (`x-forwarded-access-token`), and audit trail logging must be verified in the deployed environment.
    * `gold_batch_delivery_v` WHERE key columns (MATERIAL_ID/BATCH_ID) pending DESCRIBE TABLE — run CD-1 scenario in DEF-TRACE-006.
    * LINK_TYPE='DELIVERY' edge population requires live UAT validation before depth-aware severity is trustworthy.
    * Quality usage decision (`gold_qm_usage_decision_v`) and supplier exposure (`gold_supplier`) slices remain mock-only.
* **Document Registry:**
  * [Production Readiness Checklist](../../domain-integrations/traceability/docs/production-readiness-checklist.md)
  * [Traceability Genie Readiness Pack](../../domain-integrations/traceability/docs/traceability-genie-readiness-pack.md)
  * [Defect Backlog](../../domain-integrations/traceability/docs/traceability-defect-backlog.md)
  * [UAT Validation Ledger](../../domain-integrations/traceability/docs/uat-validation-ledger.md)
  * [V1→V2 Functional Parity Matrix](../../domain-integrations/traceability/docs/traceability-v1-v2-functional-parity.md)
  * [Golden Test Batches](../../domain-integrations/traceability/docs/golden-test-batches.md)
  * [UX Truthfulness Checklist](./ux-truthfulness-checklist.md)
  * [Databricks Column Verification Queries](../migration/databricks-column-verification-queries.md)
  * [Customer Exposure Source Mapping](../../domain-integrations/traceability/docs/customer-exposure-source-mapping.md)
  * [Customer Delivery V1 Parity Source Mapping](../../domain-integrations/traceability/docs/customer-delivery-v1-parity-source-mapping.md) ← **new**
  * [Customer Delivery Movement Type Validation](../../domain-integrations/traceability/docs/customer-delivery-movement-type-validation.md) ← **new**
  * [Customer Exposure Depth Plan](../../domain-integrations/traceability/docs/customer-exposure-depth-slice-plan.md)
  * [Quality Decision Source Plan](../../domain-integrations/traceability/docs/quality-decision-source-plan.md)
  * [Data Freshness Plan](../../domain-integrations/traceability/docs/data-freshness-plan.md)
  * [Traceability README](../../domain-integrations/traceability/README.md)

### SPC

* **Status:** High-Fidelity Sandbox (Mock/Sandbox Read-Only UAT). V1 source discovered.
  Databricks verification pack created. Live wiring not yet implemented and not yet claimed.
* **Summary:**
  * UAT readiness hardening completed: explicit adapter factory pattern implemented.
  * Evidence completeness summary and truthfulness banners active in Chart Overview.
  * Control-limit provenance and approval state tracking integrated into UI and data contracts.
  * Copy SPC UAT Evidence action available for audit logging.
  * Terminology softened (e.g., "No signals returned") to prevent overconfident process control claims.
  * **V1 Source Discovery completed (2026-05-20):** A full V1 SPC application exists at
    `apps/spc/` in the ConnectIO-RAD V1 monorepo with Databricks gold views deployed to
    `connected_plant_uat.gold`. The V2 SPC blocker is NOT absence of Databricks data — it is
    that V2 has not yet been mapped to the V1 source model. Key misalignments: V1 is
    material-centric (not plant/work-centre-centric); `spc_quality_metrics` is an AI/BI Metric
    View (not a signal table); rule violations are computed client-side in V1 (not stored);
    `spc_locked_limits` has `material_id` as a required PK dimension.
  * **Databricks Verification Pack created (2026-05-21):** SPC data exists in Databricks/V1,
    but the authoritative V2 app-serving SPC data model is not yet established. Object types,
    columns, grains, keys, control-limit provenance, rule-signal source, capability calculations,
    and golden candidates require Databricks verification before native V2 SPC live UAT. A full
    verification pack (SQL queries, evidence tables, handoff checklist) has been created in
    `domain-integrations/spc/docs/`. No verification is claimed by this pack — it must be
    executed by a person with live Databricks access.
  * **FastAPI proxy routes created:** `apps/api/routes/spc.py` now contains proxy routes for
    V1 SPC metadata and chart-data endpoints. These routes are NOT browser-verified against a
    live V1 backend and should not be used until the V1 SPC app URL is confirmed in UAT.
* **UAT Blockers:**
  1. V1 SPC app URL must be confirmed as accessible in UAT Databricks workspace.
  2. `SPCMonitoringAdapterRequest` must be updated to be material-centric (add `materialId` as primary parameter).
  3. FastAPI proxy routes in `apps/api/routes/spc.py` must be browser-verified against live V1 backend.
  4. `SPCMonitoringLegacyApiAdapter` must be implemented with correct V1 field mapping.
  5. Gold view column names must be verified against actual DDL in UAT — run verification queries
     from `spc-databricks-source-verification.md`.
  6. Column name discrepancy in `spc_locked_limits` must be resolved by live DDL check (see
     `spc-control-limit-provenance-verification.md`).
  7. A confirmed plant/material/MIC UAT candidate with live SPC data must be identified — use
     discovery queries in `golden-spc-candidates.md`.
  8. Native migration readiness checklist (`spc-native-migration-readiness-checklist.md`) must
     be completed before any live SPC route is enabled.
* **Document Registry:**
  * [SPC README](../../domain-integrations/spc/README.md)
  * [SPC V1 Source Discovery](../../domain-integrations/spc/docs/spc-v1-source-discovery.md)
  * [SPC V2 Migration Assessment](../../domain-integrations/spc/docs/spc-v2-migration-assessment.md)
  * [Golden SPC Candidates](../../domain-integrations/spc/docs/golden-spc-candidates.md)
  * [SPC Genie Readiness Pack](../../domain-integrations/spc/docs/spc-genie-readiness-pack.md)
  * [SPC Readiness & Hardening Notes](../migration/spc-readiness-and-hardening-notes.md)
  * [SPC UAT Acceptance Script](../../domain-integrations/spc/docs/spc-uat-acceptance-script.md)
  * [SPC Known Limitations](../../domain-integrations/spc/docs/spc-known-limitations.md)
  * [Databricks Source Verification Pack](../../domain-integrations/spc/docs/spc-databricks-source-verification.md) ← **new**
  * [Data Model Grain Assessment](../../domain-integrations/spc/docs/spc-data-model-grain-assessment.md) ← **new**
  * [Navigation Model Verification](../../domain-integrations/spc/docs/spc-navigation-model-verification.md) ← **new**
  * [Control Limit Provenance Verification](../../domain-integrations/spc/docs/spc-control-limit-provenance-verification.md) ← **new**
  * [Rule / Signal Source Verification](../../domain-integrations/spc/docs/spc-rule-signal-source-verification.md) ← **new**
  * [Capability Verification](../../domain-integrations/spc/docs/spc-capability-verification.md) ← **new**
  * [V2 Contract Mapping](../../domain-integrations/spc/docs/spc-v2-contract-mapping.md) ← **new**
  * [Native Migration Readiness Checklist](../../domain-integrations/spc/docs/spc-native-migration-readiness-checklist.md) ← **new**

### Process Order History (POH) & Operations

* **Status:** Databricks/API wired at code or SQL level; browser/live UI validation pending.
* **Summary:**
  * A read-only Process Order History (POH) cockpit exists.
  * A deterministic **POH Assistant Pilot** now exists as a dedicated workspace view limited to approved operations, confirmations, goods movements, and conditional header questions.
  * Source truthfulness has been improved; planned filter inputs (such as limit, date range, etc.) are labeled as planned/diagnostic.
  * Golden process-order candidates exist in UAT (e.g., process order `7006965038`).
  * Direct SQL/DDL reads are verified for `getProcessOrderHeader`, `getOrderOperations`, `getOrderConfirmations`, and `getOrderGoodsMovements`.
  * Section-level completeness is visible in the POH screen for header, operations, confirmations, and goods movements. No-record sections are treated as partial evidence, not proof of absence.
  * Copy UAT Evidence payload includes section source status, section completeness, counts, and explicit warnings that production readiness is not claimed.
  * **UAT Blockers:**
    * Live browser validation of the HTTP/UI layer is pending (BV pending).
    * Candidate counts must be compared to SAP/Databricks source evidence during UAT.
    * Potential module-boundary lint warnings remain on cross-domain type imports from Quality.
* **Document Registry:**
  * [Operations README](../../domain-integrations/operations/README.md)
  * [POH Genie Readiness Pack](../../domain-integrations/operations/docs/poh-genie-readiness-pack.md)
  * [Golden Process Orders Candidates](../../domain-integrations/operations/docs/golden-process-orders.md)
  * [POH UAT Readiness Notes](../../domain-integrations/operations/docs/poh-uat-readiness-notes.md)
  * [POH V1 to V2 Functional Parity](../../domain-integrations/operations/docs/poh-v1-v2-functional-parity.md)
  * [POH Investigation Screen Notes](../migration/poh-investigation-screen-notes.md)

### Warehouse360

* **Status:** Hybrid (Mock / Databricks API).
* **Summary:**
  * Source badges and mock source attribution have been improved.
  * Overview KPI site-level scope is documented; the cockpit warns users that the summary KPI data is global rather than warehouse-filtered.
  * Exception guidance has been softened to advisory in the codebase (`Review Guidance` instead of `Recommended Action`) under PR #35 (merged).
  * **UAT Blockers:**
    * Warehouse360 source-view/schema alignment requires live UAT verification; specific missing columns/views should be confirmed from the warehouse migration audit.
* **Document Registry:**
  * [Warehouse README](../../domain-integrations/warehouse/README.md)
  * [Warehouse Adapter Migration Strategy](../adapters/warehouse-adapter-migration-strategy.md)
  * [Warehouse Functional Parity Audit](../migration/warehouse-functional-parity-audit.md)

### Quality Batch Release

* **Status:** High-Fidelity Sandbox (Mock / Legacy API) — Hardening merged in PR #34.
* **Summary:**
  * Release decision panels (Summary, Hold/Impact, Deviations, CoA, Decision History) are mock/simulated.
  * Connected Quality Lab Board is wired to a legacy API proxy (browser verification is pending).
  * **V1 source discovery completed (2026-05-21):** V1 has real read-only inspection/MIC/usage-decision/CoA-result evidence across ConnectedQuality, POH, and Trace2, but no governed production batch-release workflow, e-signature, SAP QM write-back, or live deviation workflow was proven.
  * **Read-only evidence foundation started (2026-05-21):** Databricks source verification pack is ready, read-only Quality evidence contracts are in data-contracts, an unavailable adapter skeleton exists, and a pending-verification panel scaffold is mounted in the Quality Evidence view. Native route/live data implementation remains pending source verification.
  * **QM usage-decision verification pack created (2026-05-21):** Dedicated verification pack (`qm-usage-decision-source-verification.md`), grain/join assessment (`qm-usage-decision-grain-and-joins.md`), code-semantics and release-boundary rules (`qm-usage-decision-code-semantics.md`), and cross-domain consumption plan (`qm-usage-decision-cross-domain-consumption-plan.md`) added. Object `gold_inspection_usage_decision` is located in the catalog (TRACE-P1-012); schema, grain, join keys, and code semantics are **not yet verified** — no SQL has been run. TRACE-P1-012 status = **verification pack ready**.
  * Missing usage-decision, CoA, or deviation evidence must not be interpreted as accepted, released, or no issue.
  * Release actions are simulated-only; no SAP QM write-back or e-signatures/audit trails are implemented.
  * **UAT Blockers:**
    * No Databricks adapter or route exists for native read-only Quality evidence.
    * Databricks source verification pack has not been run against UAT.
    * No verified live Quality UAT candidate has been identified.
    * Production release decisions are blocked until SAP QM integration and GxP e-signature compliance are designed.
* **Document Registry:**
  * [Quality README](../../domain-integrations/quality/README.md)
  * [Quality V1 Source Discovery](../../domain-integrations/quality/docs/quality-v1-source-discovery.md)
  * [Quality V2 Parity Roadmap](../../domain-integrations/quality/docs/quality-v2-parity-roadmap.md)
  * [Quality Databricks Source Verification Pack](../../domain-integrations/quality/docs/quality-databricks-source-verification.md)
  * [QM Usage-Decision Source Verification Pack](../../domain-integrations/quality/docs/qm-usage-decision-source-verification.md) ← **new**
  * [QM Usage-Decision Grain and Join Assessment](../../domain-integrations/quality/docs/qm-usage-decision-grain-and-joins.md) ← **new**
  * [QM Usage-Decision Code Semantics and Release Boundaries](../../domain-integrations/quality/docs/qm-usage-decision-code-semantics.md) ← **new**
  * [QM Usage-Decision Cross-Domain Consumption Plan](../../domain-integrations/quality/docs/qm-usage-decision-cross-domain-consumption-plan.md) ← **new**
  * [Quality Read-Only Evidence Route Plan](../../domain-integrations/quality/docs/quality-readonly-evidence-route-plan.md)
  * [Quality Read-Only Evidence Panel Scaffold](../../domain-integrations/quality/docs/quality-readonly-evidence-panel-design.md)
  * [Quality/SPC Shared MIC Evidence Boundaries](../../domain-integrations/quality/docs/quality-spc-shared-mic-evidence.md)
  * [Golden Quality Candidates](../../domain-integrations/quality/docs/golden-quality-candidates.md)
  * [Quality Production Readiness Checklist](../../domain-integrations/quality/docs/quality-readiness-checklist.md)
  * [Golden Quality Batches Candidates](../../domain-integrations/quality/docs/golden-quality-batches.md)
  * [Quality Known Limitations](../../domain-integrations/quality/docs/quality-known-limitations.md)
  * [Quality UAT Acceptance Script](../../domain-integrations/quality/docs/quality-uat-acceptance-script.md)

### Environmental Monitoring (EnvMon)

* **Status:** Databricks/API wired; browser/live UAT evidence should be confirmed from existing migration docs.
* **Summary:**
  * Hybrid domain. Both `getEnvMonSiteSummary` and `getEnvMonSwabResults` are wired to Databricks SQL.
  * **UAT Blockers:**
    * Plant maps, floors, location coordinates, and heatmap renderings are deferred/scoped-out due to undefined business rules or missing coordinates in UAT.
* **Document Registry:**
  * [EnvMon Site Summary Native Route Plan](../migration/envmon-site-summary-native-route-plan.md)
  * [EnvMon V1 Functional Recovery](../migration/envmon-v1-functional-recovery.md)
  * [EnvMon V1 Deep Dive](../migration/envmon-v1-deep-dive.md)

### Maintenance and Reliability

* **Status:** Mock Only.
* **Summary:**
  * All 7 maintenance adapter methods are mock-only.
  * No EAM source views have been identified or verified.
  * **UAT Blockers:**
    * Business integration contract with SAP PM is not finalized.
* **Document Registry:**
  * No standalone documentation directory. Ref: `domain-integrations/maintenance/src/adapters/maintenance-reliability-adapter.ts`.

### Production Staging

* **Status:** Mock Only.
* **Summary:**
  * All 9 production staging adapter methods are mock-only.
  * No WMS staging views are identified.
  * **UAT Blockers:**
    * Integration requirements with warehouse management systems are undefined.
* **Document Registry:**
  * No standalone documentation directory. Ref: `domain-integrations/warehouse/src/adapters/production-staging-adapter.ts`.

---

## 5. Current Blockers

The following list summarizes the critical items blocking live validation or production cutover:

* **Traceability Blockers:**
  1. Live Databricks UAT validation has not occurred.
  2. `gold_batch_mass_balance_v` WHERE filter column names unverified (TODO markers remain in SQL) — blocks mass balance live route.
  3. `gold_batch_delivery_v` column names unverified — blocks `countries` and `blockedDeliveries` fields in customer exposure slice. Lineage-only first slice now implemented but LINK_TYPE='DELIVERY' edge population requires live validation (P0-003).
  4. `gold_qm_usage_decision_v` (or equivalent) not yet identified — blocks quality usage decision (P0).
  5. `gold_supplier` not in catalog resolver — blocks supplier exposure live slice (P1).
  6. OAuth token forwarding validation in the deployed environment.
* **SPC Blockers:**
  1. V1 SPC app URL must be confirmed as accessible in UAT Databricks workspace (`apps/spc/` in ConnectIO-RAD).
  2. `SPCMonitoringAdapterRequest` must add `materialId` as primary entry-point parameter (V1 is material-centric).
  3. FastAPI proxy routes in `apps/api/routes/spc.py` exist but are NOT browser-verified — must test against live V1 backend.
  4. `SPCMonitoringLegacyApiAdapter` must be implemented with correct V1 field mapping (see `spc-v1-source-discovery.md`).
  5. Gold view column names must be verified against actual UAT DDL — run queries in `spc-databricks-source-verification.md`.
  6. Column name discrepancy in `spc_locked_limits` must be resolved by `DESCRIBE TABLE` (see `spc-control-limit-provenance-verification.md`).
  7. A UAT candidate plant/material/MIC combination with confirmed SPC data must be identified via discovery queries in `golden-spc-candidates.md`.
  8. Native migration readiness checklist (`spc-native-migration-readiness-checklist.md`) must be completed before any live route is enabled.
* **Process Order History Blockers:**
  1. Browser-level validation of the 4 api endpoints inside the UI has not been performed.
* **Warehouse360 Blockers:**
  1. Warehouse360 source-view/schema alignment requires live UAT verification; specific missing columns/views should be confirmed from the warehouse migration audit.
* **Quality Batch Release Blockers:**
  1. Run Quality Databricks source verification packs (`quality-databricks-source-verification.md` and `qm-usage-decision-source-verification.md`) and capture source-object/column/grain evidence.
  2. Verify QM usage-decision source: object `gold_inspection_usage_decision` is located in catalog (TRACE-P1-012, 2026-05-21) but schema, grain, join keys, and code semantics are not verified — TRACE-P1-012 status is now **verification pack ready**.
  3. Identify at least one verified live Quality UAT candidate.
  4. Implement source-backed read-only inspection lot/MIC evidence before any release-decision work.
  5. SAP QM write-back and GxP e-signature mechanisms must be designed and implemented before any controlled release workflow.
  6. Governed SAP QM usage-decision code mapping must be confirmed by Kerry Quality/QM process owner before any accepted/released/rejected display is added.

---

## 6. Next Validation Sequence

To coordinate verification systematically, the following sequence is recommended:

1. **Traceability Live Databricks Validation:**  
   Execute first E2E query and browser walk using the following validated candidate:
   * **Material ID:** `000000000020052009`
   * **Batch ID:** `0008602411`
   * **Plant ID:** `C061`
   
2. **Process Order History Browser Validation:**  
   Confirm browser-level rendering of process order details, operations, confirmations, and movements using the golden candidate:
   * **Process Order ID:** `7006965038` (Plant: `C113`)

3. **Warehouse360 Source Validation:**  
   Verify Warehouse summary view and perform schema-alignment walks against known plant/warehouse candidates:
   * **Warehouse ID:** `104` or `105`

4. **Quality Lab Board & Simulation Validation:**  
   * Validate the Lab Board legacy API route (`GET /api/cq/lab/plants` and `GET /api/cq/lab/fails`) E2E.
   * Keep all release actions strictly mocked/simulated until SAP QM write-back has been architected.

5. **SPC Control Chart Validation:**  
   * Validate the approved control-limit source DDL.
   * Verify the SPC rule evaluation calculations against plant-approved standards.

---

## 7. Cross-Domain Evidence Required Before Go-Live

Before any domain is cut over to production, the following evidence must be captured and recorded:

- [ ] Deployed app URL and commit SHA recorded.
- [ ] Adapter mode recorded per domain.
- [ ] Source badges captured in screenshots.
- [ ] Golden test cases executed.
- [ ] Live Databricks / legacy API outputs compared with source systems.
- [ ] UC/OAuth/permission behaviour verified where applicable.
- [ ] Audit logging confirmed where applicable.
- [ ] Data freshness / dataAsOf strategy implemented or risk-accepted.
- [ ] Mock mode disabled or blocked in production.
- [ ] UAT defects triaged and closed/risk-accepted.

---

## 8. Follow-up Document Hygiene

The following phrases in existing documentation must be reviewed to ensure they do not overstate readiness:

* **“production ready”** / **“fully validated”** — Flagged in Traceability docs (parity review) and Quality docs. These should be clarified as "code-ready, awaiting live UAT verification."
* **“mock mode disabled”** — Needs to be verified as enforced via environment configurations, not assumed as a default.
* **“all clear”** / **“all stock reconciled”** — Softened in Warehouse360 copy to prevent false assurance during outages.
* **“released”** / **“approved”** — Must always be prefaced as simulated or coordinate-only in Quality Batch Release documentation until write-back is wired.
