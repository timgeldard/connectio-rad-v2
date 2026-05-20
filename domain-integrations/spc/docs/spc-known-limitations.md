# SPC Known Limitations — Read-Only UAT

The Statistical Process Control (SPC) domain is currently in a **High-Fidelity Sandbox** state. While the UI and workflow logic are code-ready, the following limitations must be acknowledged before operational use.

## 1. Data Source Gaps

- **Source Not Yet Mapped in V2**: A full V1 SPC application exists at `apps/spc/` in the ConnectIO-RAD V1 repo. It deploys `spc_quality_metric_subgroup_v`, `spc_locked_limits`, and related objects to `connected_plant_uat.gold`. V2 SPC has not yet been mapped to these sources.
- **V2 Data Model Misalignment**: The V1 SPC data model is material-centric (`material_id → plant_id → mic_id`). V2's current adapter request uses `plantId + workCentreId` as primary scope. This must be reconciled before live wiring.
- **`spc_quality_metrics` is an AI/BI Metric View**: V2 docs previously described `spc_quality_metrics` as a signal/alarm storage table. It is actually a Databricks `WITH METRICS LANGUAGE YAML` governance view. Real-time rule violation detection in V1 is computed client-side, not stored.
- **Legacy API**: A V1 SPC FastAPI backend exists (`apps/spc/backend/spc_backend/`) but V2's `SPCMonitoringLegacyApiAdapter` has not yet been wired to it. The V1 app URL in the UAT Databricks workspace must be confirmed before proxy routes can be implemented.
- **See**: [SPC V1 Source Discovery](./spc-v1-source-discovery.md) for the full source discovery and mapping.

## 2. Statistical Limitations

- **Simulated Limits**: Control limits (UCL, LCL) and centrelines (CL) are currently static fixtures or mock-calculated. They have **not** been approved by Kerry Ingredients Quality Leads for any site.
- **Rule Engine**: Western Electric and Nelson rule violations are simulated outputs of the mock adapter. These must be cross-verified against a live rule engine once backend connectivity is established.
- **Subgroup Logic**: The current sandbox does not support dynamic subgroup size adjustment (e.g., n=5 vs n=1).

## 3. UI/UX Limitations

- **Filters**: Diagnostic filters (e.g., date range, limit overrides) are labeled as "Planned" and do not yet trigger backend re-calculation.
- **i18n**: Labels and warning strings are currently English-only.
- **Drill-through**: Drill-through to Batch Release and Traceability is supported but relies on mock batch IDs in the sandbox environment.

## 4. Regulatory Compliance

- **GxP Warning**: This sandbox environment is **not** validated for GxP decision-making. No release decisions or process adjustments should be made based on the data rendered in this workspace.
- **Audit Trail**: Acknowledgements and investigation requests are mock-only; no persistent audit trail is captured in the backend.
