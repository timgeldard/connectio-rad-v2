# SPC Known Limitations — Read-Only UAT

The Statistical Process Control (SPC) domain is currently in a **High-Fidelity Sandbox** state. While the UI and workflow logic are code-ready, the following limitations must be acknowledged before operational use.

## 1. Data Source Gaps

- **Catalog Alignment**: The `spc_quality_metrics`, `spc_quality_metric_subgroup_v`, and `spc_locked_limits` schemas do not yet exist in the `connected_plant_uat.gold` catalog. Native Databricks integration is blocked until these are deployed.
- **Legacy API**: No legacy V1 backend currently exists for SPC; therefore, no `legacy-api` adapter mode is supported beyond simulation.

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
