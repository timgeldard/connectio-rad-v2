# Statistical Process Control (SPC) Domain Integration

This directory houses the SPC domain-integration components, including adapters, queries, views, workspaces, and Evidence Panels.

## Current Readiness & Source Status (Read-Only UAT)

- **Current Source Mode**: High-Fidelity Sandbox / Read-Only UAT.
- **Data Veracity**: Simulated data for workflow and UI layout validation. All control limits and signals are marked as **unverified**.
- **Regulatory Status**: Do **not** use the limits, centrelines, or warning signals rendered in this sandbox for regulatory decisions.

## UAT Readiness Documentation

- [SPC UAT Acceptance Script](./docs/spc-uat-acceptance-script.md)
- [SPC Known Limitations](./docs/spc-known-limitations.md)
- [SPC Readiness & Hardening Notes](../../docs/migration/spc-readiness-and-hardening-notes.md)
- [V1 Genie Discovery and V2 Parity Roadmap](../../docs/migration/v1-genie-discovery-and-v2-parity-roadmap.md)
- [SPC Genie Readiness Pack](./docs/spc-genie-readiness-pack.md)

## V1 SPC Source Status

A full V1 SPC application exists at `apps/spc/` in the ConnectIO-RAD V1 monorepo. It deploys gold-layer objects to `connected_plant_uat.gold` and has a live FastAPI backend. Existing V1 SPC data may already exist in Databricks, but the V2 SPC domain has not yet been mapped to that source.

Current V2 target views, control-limit source, rule semantics, and contract mappings require discovery and verification before live SPC UAT. Current V2 SPC remains mock/sandbox until the V1 Databricks source mapping is verified and native V2 routes/mappers are implemented.

See [SPC V1 Source Discovery](./docs/spc-v1-source-discovery.md) for the full finding.

## Integration Gates & Out-of-Scope Items

1. **V1 Proxy Routes**: `SPCMonitoringLegacyApiAdapter` exists but is not wired. V1 SPC FastAPI endpoints are known (see source discovery doc) but V2 proxy routes in `apps/api/routes/spc.py` do not yet exist.
2. **Navigation Model**: V2's `SPCMonitoringAdapterRequest` is plant/work-centre-centric. V1 is material-centric. This must be reconciled before any wiring.
3. **Adapter Factory**: A factory pattern is implemented to support `mock`, `legacy-api`, and `databricks-api` modes; the latter two currently return unavailable status.
4. **Evidence Completeness**: Section-level completeness summaries are visible in the Chart Overview view.

## Remaining Production Readiness Milestones

To migrate from sandbox mock mode to a production-ready state:

- **V1 App URL Confirmation**: Confirm the V1 SPC Databricks App URL is accessible in the UAT environment.
- **Navigation Model Fix**: Update `SPCMonitoringAdapterRequest` to use `materialId` as the primary entry-point parameter.
- **Proxy Route Implementation**: Create `apps/api/routes/spc.py` with proxy routes to V1 SPC endpoints.
- **Adapter Wiring**: Implement `SPCMonitoringLegacyApiAdapter` using verified V1 field shapes.
- **Column Verification**: Verify `spc_quality_metric_subgroup_v` and `spc_locked_limits` column names in UAT.
- **UAT Candidate Identification**: Confirm a real plant/material/MIC combination with SPC data in `connected_plant_uat.gold`.
- **Source Badge Verification**: Verify `<EvidencePanel>` badge updates to `source: 'legacy-api'` once proxy is wired.
- **Control-Rule Semantics**: Confirm whether rule detection should remain frontend-computed (per V1) or move to API layer.
- **i18n Support**: Introduce localization support for titles and warning strings if required.
