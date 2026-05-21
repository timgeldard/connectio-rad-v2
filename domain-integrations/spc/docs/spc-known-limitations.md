# SPC Known Limitations — Read-Only UAT

The Statistical Process Control (SPC) domain is currently in a **High-Fidelity Sandbox** state.
While the UI and workflow logic are code-ready, the following limitations must be acknowledged
before operational use.

SPC data exists in Databricks via the V1 SPC application (`apps/spc/` in ConnectIO-RAD V1),
but the authoritative V2 app-serving SPC data model is not yet established. Object types,
columns, grains, keys, control-limit provenance, rule-signal source, capability calculations,
and golden candidates require Databricks verification before native V2 SPC live UAT.

## 1. Data Source Gaps

- **Source Not Yet Mapped in V2**: A full V1 SPC application exists at `apps/spc/` in the
  ConnectIO-RAD V1 repo. It deploys `spc_quality_metric_subgroup_v`, `spc_locked_limits`, and
  related objects to `connected_plant_uat.gold`. V2 SPC has not yet been mapped to these
  sources. The Databricks verification pack in `spc-databricks-source-verification.md` provides
  the SQL queries required to confirm the data model before any wiring is attempted.
- **V2 Data Model Misalignment**: The V1 SPC data model is material-centric
  (`material_id → plant_id → mic_id`). V2's current adapter request uses
  `plantId + workCentreId` as primary scope. This must be reconciled before live wiring.
  See [spc-navigation-model-verification.md](./spc-navigation-model-verification.md).
- **`spc_quality_metrics` is an AI/BI Metric View**: Not a signal or alarm storage table.
  It is a Databricks `WITH METRICS LANGUAGE YAML` governance view. Real-time rule violation
  detection in V1 is computed client-side, not stored.
- **No stored alarm history**: V1 has no alarm history table. V2's `SPCAlarmHistoryPanel` has
  no live data source. It must remain mock-only until a new design is agreed.
- **Control-limit column name discrepancy**: Two V2 documents reference different column names
  for `spc_locked_limits` fields (`usl`/`lsl` vs `spec_signature`, `effective_from` vs
  `baseline_from`). This must be resolved by running `DESCRIBE TABLE` against live UAT DDL
  before any column-level mapping is implemented.
  See [spc-control-limit-provenance-verification.md](./spc-control-limit-provenance-verification.md).
- **Proxy Routes Not Yet Browser-Verified**: `apps/api/routes/spc.py` proxy routes now exist
  in V2 code, but have not been browser-verified against a live V1 backend. The V1 SPC app
  URL in the UAT Databricks workspace must be confirmed first.
- **See**: [SPC V1 Source Discovery](./spc-v1-source-discovery.md) for the full source
  discovery and mapping.
- **See**: [SPC Databricks Source Verification](./spc-databricks-source-verification.md) for
  the full Databricks verification pack and handoff checklist.

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
