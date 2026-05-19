# Quality / Batch Release Known Limitations

This document lists the architectural limitations and scope boundaries for the Quality / Batch Release workspace in the current Phase 2 release. These limitations must be resolved before any operational deployment.

---

## 1. Simulated Release Decisions & Data Views

Except for the Lab Board view (which is wired to the legacy V1 API proxy), all data rendered across the decision cockpit is simulated using mock data adapters:
- **Release Queue**: The queue of batch cases is a static, simulated mock list.
- **Release Decision Summaries**: Overall readiness status (`ready`, `blocked`, `conditional`) and Recommended Actions (`release`, `reject`, `escalate`) are simulated by rules in the mock adapter.
- **CoA Readiness**: Certificate of Analysis completeness checklists and missing field highlights are simulated in-memory records.
- **Quality Results**: Overall inspection lot statuses, category results (MIC, chemical, physical, sensory), and specific pathogen failures (such as Listeria spp. counts) are simulated.
- **Deviation Summaries**: Active deviation counts, severity tiers, and release-blocking attributes are simulated.

*Operational Impact*: Do **not** trust the completeness or accuracy of any batch information displayed on these views.

---

## 2. Simulation-Only Actions & Write-Backs

All interactive forms in the right-rail Actions panel run in simulated mode:
- **Release Batch**: Submitting a release decision or conditional release displays a success dialog and emits console logs, but does **not** update the SAP QM system or modify database records.
- **Place on Hold**: Placing a batch on hold is a mock action and does not apply an actual warehouse block or SAP hold status.
- **Request Retest**: Triggers a simulated success screen; no request is dispatched to laboratory systems.
- **Escalate Deviation**: Simulation only.

*Operational Impact*: The cockpit does **not** possess write permissions to any Kerry system. All release actions must be performed manually in SAP GUI.

---

## 3. Regulatory Compliance & e-Signatures

- **No 21 CFR Part 11 Compliance**: The simulated "Signoff Name" and "Rationale" input fields do not perform cryptographic signatures, dual-authorization checks, password re-entry, or secure database logging.
- **No Secure Audit Trail**: Decisions made in the cockpit are lost on page refresh and are not saved to a persistent, tamper-evident database audit log.

*Operational Impact*: Under no circumstances should this V2 frontend prototype be used as a final authority for GxP release actions.

---

## 4. Databricks SQL Integration

- **No Databricks-API Adapter**: Databricks-API mode is not implemented for the Quality domain. The adapter factory ignores `databricks-api` mode and falls back to legacy-api/mock mode.
- **No Unity Catalog Grants**: No Unity Catalog schemas, row-level filters, or column security masks have been verified for quality tables.
