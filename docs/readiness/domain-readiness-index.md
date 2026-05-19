# Cross-Domain Readiness Index & Navigation Layer

**Date:** 2026-05-19  
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
| **SPC** | 🔶 | ❌ | ❌ | Database catalog alignment of `spc_quality_metrics` schema; approved control limits. | [SPC Detail](#spc) |
| **Process Order History (POR)** | 🔶 | 🔶 | ❌ | Browser/live verification of the HTTP/UI layer; date controls implementation. | [Process Order History Detail](#process-order-history--operations) |
| **Warehouse360** | 🔶 | ❌ | ❌ | Aligning schemas of inbound, outbound, staging, and exception views in Databricks. | [Warehouse360 Detail](#warehouse360) |
| **Quality Batch Release** | 🔶 | ❌ | ❌ | Mock release panels; no live SAP QM usage-decision/write-back/e-signature. | [Quality Detail](#quality-batch-release) |
| **Environmental Monitoring (EnvMon)** | ✅ | ✅ | ❌ | Floorplan zoning heatmap config is deferred; alert rules undefined. | [EnvMon Detail](#environmental-monitoring-envmon) |
| **Maintenance & Reliability** | 🔶 | ❌ | ❌ | No gold views identified; SAP PM data-access contracts not signed. | [Maintenance Detail](#maintenance-and-reliability) |
| **Production Staging** | 🔶 | ❌ | ❌ | No gold views confirmed; WMS source views not identified. | [Production Staging Detail](#production-staging) |

---

## 4. Domain-by-Domain Detail

### Traceability

* **Status:** Hybrid (Mock / Databricks API).
* **Summary:**
  * Has a strong, high-fidelity mock/demo cockpit supporting trace investigation.
  * Evidence confidence badge logic is fully implemented to display complete, partial, or unknown levels.
  * Resolved the null customer exposure vulnerability (binary severity fallback to `UNKNOWN` instead of defaulting to a false containment/safe state).
  * Edge relationship link types are code-ready, allowing UI to discriminate vendor receipts from internal moves.
  * Depth-aware severity schema is code-ready (incorporating `maxExposureDepth` on frontend).
  * Unified graph truncation banner is code-ready, showing warnings when `max_depth_reached` or `max_edges_reached` is triggered.
  * **UAT Blockers:**
    * Live Databricks UAT is blocked: no live E2E validation against UAT databases has occurred.
    * Column names in `gold_batch_summary_v` must be verified via queries defined in `databricks-column-verification-queries.md`.
    * Unity Catalog, OAuth token forwarding (`x-forwarded-access-token`), and audit trail logging must be verified in the deployed environment.
* **Document Registry:**
  * [Production Readiness Checklist](file:///home/timgeldard/github/connectio-rad-v2/domain-integrations/traceability/docs/production-readiness-checklist.md)
  * [Defect Backlog](file:///home/timgeldard/github/connectio-rad-v2/domain-integrations/traceability/docs/traceability-defect-backlog.md)
  * [UAT Validation Ledger](file:///home/timgeldard/github/connectio-rad-v2/domain-integrations/traceability/docs/uat-validation-ledger.md)
  * [Golden Test Batches](file:///home/timgeldard/github/connectio-rad-v2/domain-integrations/traceability/docs/golden-test-batches.md)
  * [Databricks Column Verification Queries](file:///home/timgeldard/github/connectio-rad-v2/docs/migration/databricks-column-verification-queries.md)
  * [Customer Exposure Depth Plan](file:///home/timgeldard/github/connectio-rad-v2/domain-integrations/traceability/docs/customer-exposure-depth-slice-plan.md)
  * [Quality Decision Source Plan](file:///home/timgeldard/github/connectio-rad-v2/domain-integrations/traceability/docs/quality-decision-source-plan.md)
  * [Data Freshness Plan](file:///home/timgeldard/github/connectio-rad-v2/domain-integrations/traceability/docs/data-freshness-plan.md)
  * [Traceability README](file:///home/timgeldard/github/connectio-rad-v2/domain-integrations/traceability/README.md)

### SPC

* **Status:** High-Fidelity Sandbox (Mock Only).
* **Summary:**
  * Sandbox/mock data truthfulness has been improved to ensure simulated limits are not shown as live.
  * Source badges and warnings are active in the UI.
  * Missing control limits and insufficient data points are explicitly labeled to prevent false assurance.
  * **UAT Blockers:**
    * Live execution is blocked by the pending database catalog alignment of the `spc_quality_metrics` schema in UAT.
    * Approved control-limit sources, validated SPC rules, and live QM/MIC data feeds must be established before migrating from the high-fidelity mock Sandbox.
* **Document Registry:**
  * [SPC README](file:///home/timgeldard/github/connectio-rad-v2/domain-integrations/spc/README.md)
  * [SPC Readiness & Hardening Notes](file:///home/timgeldard/github/connectio-rad-v2/docs/migration/spc-readiness-and-hardening-notes.md)

### Process Order History & Operations

* **Status:** Databricks API (Wired & Verified).
* **Summary:**
  * A read-only Process Order History (POR) cockpit exists.
  * Source truthfulness has been improved; planned filter inputs (such as limit, date range, etc.) are labeled as planned/diagnostic.
  * Golden process-order candidates exist in UAT (e.g., process order `7006965038`).
  * Direct SQL/DDL reads are verified for `getProcessOrderHeader`, `getOrderOperations`, `getOrderConfirmations`, and `getOrderGoodsMovements`.
  * **UAT Blockers:**
    * Live browser validation of the HTTP/UI layer is pending (BV pending).
    * Potential module-boundary lint warnings remain on cross-domain type imports from Quality.
* **Document Registry:**
  * [Operations README](file:///home/timgeldard/github/connectio-rad-v2/domain-integrations/operations/README.md)
  * [Golden Process Orders Candidates](file:///home/timgeldard/github/connectio-rad-v2/domain-integrations/operations/docs/golden-process-orders.md)
  * [POH Investigation Screen Notes](file:///home/timgeldard/github/connectio-rad-v2/docs/migration/poh-investigation-screen-notes.md)

### Warehouse360

* **Status:** Hybrid (Mock / Databricks API).
* **Summary:**
  * Source badges and mock source attribution have been improved.
  * Overview KPI site-level scope is documented; the cockpit warns users that the summary KPI data is global rather than warehouse-filtered.
  * Exception guidance has been softened to advisory in the codebase (`Review Guidance` instead of `Recommended Action`).
  * **UAT Blockers:**
    * Schema unalignment exists on `inbound` and `outbound` views.
    * View names do not exist/are unaligned for `staging` and `exceptions` in the UAT schema (`staging_orders_v` and `wh360_imwm_exceptions_v`).
* **Document Registry:**
  * [Warehouse README](file:///home/timgeldard/github/connectio-rad-v2/domain-integrations/warehouse/README.md)
  * [Warehouse Adapter Migration Strategy](file:///home/timgeldard/github/connectio-rad-v2/docs/adapters/warehouse-adapter-migration-strategy.md)
  * [Warehouse Functional Parity Audit](file:///home/timgeldard/github/connectio-rad-v2/docs/migration/warehouse-functional-parity-audit.md)

### Quality Batch Release

* **Status:** High-Fidelity Sandbox (Mock / Legacy API).
* **Summary:**
  * Release decision panels (Summary, Hold/Impact, Deviations, CoA, Decision History) are mock/simulated.
  * Connected Quality Lab Board is wired to a legacy API proxy (browser verification is pending).
  * Release actions are simulated-only; no SAP QM write-back or e-signatures/audit trails are implemented.
  * **UAT Blockers:**
    * No Databricks adapter exists for quality release.
    * Production release decisions are blocked until SAP QM integration and GxP e-signature compliance are designed.
* **Document Registry:**
  * [Quality README](file:///home/timgeldard/github/connectio-rad-v2/domain-integrations/quality/README.md)
  * [Quality Production Readiness Checklist](file:///home/timgeldard/github/connectio-rad-v2/domain-integrations/quality/docs/quality-readiness-checklist.md)
  * [Golden Quality Batches Candidates](file:///home/timgeldard/github/connectio-rad-v2/domain-integrations/quality/docs/golden-quality-batches.md)
  * [Quality Known Limitations](file:///home/timgeldard/github/connectio-rad-v2/domain-integrations/quality/docs/quality-known-limitations.md)
  * [Quality UAT Acceptance Script](file:///home/timgeldard/github/connectio-rad-v2/domain-integrations/quality/docs/quality-uat-acceptance-script.md)

### Environmental Monitoring (EnvMon)

* **Status:** Databricks API (Wired & Verified).
* **Summary:**
  * Hybrid domain. Both `getEnvMonSiteSummary` and `getEnvMonSwabResults` are wired to Databricks SQL and fully browser-verified in the UAT app deployment.
  * UI workspace is fully browser-verified with live data.
  * **UAT Blockers:**
    * Plant maps, floors, location coordinates, and heatmap renderings are deferred/scoped-out due to undefined business rules or missing coordinates in UAT.
* **Document Registry:**
  * [EnvMon Site Summary Native Route Plan](file:///home/timgeldard/github/connectio-rad-v2/docs/migration/envmon-site-summary-native-route-plan.md)
  * [EnvMon V1 Functional Recovery](file:///home/timgeldard/github/connectio-rad-v2/docs/migration/envmon-v1-functional-recovery.md)
  * [EnvMon V1 Deep Dive](file:///home/timgeldard/github/connectio-rad-v2/docs/migration/envmon-v1-deep-dive.md)

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
  2. The `gold_batch_summary_v` columns must be verified against actual DDL.
  3. OAuth token forwarding validation in the deployed environment.
* **SPC Blockers:**
  1. Catalog alignment of the `spc_quality_metrics` schema in UAT is pending.
  2. Limits and rules source data must be populated.
* **Process Order History Blockers:**
  1. Browser-level validation of the 4 api endpoints inside the UI has not been performed.
* **Warehouse360 Blockers:**
  1. WAREHOUSE_NUMBER column is missing from `wh360_deliveries_v`.
  2. `staging_orders_v` and `wh360_imwm_exceptions_v` do not exist in UAT.
* **Quality Batch Release Blockers:**
  1. SAP QM write-back and GxP e-signature mechanisms must be designed and implemented.

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
