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

## Integration Gates & Out-of-Scope Items

1. **Native Databricks Execution**: Native Databricks SPC execution is out of scope for the current design phase.
2. **Adapter Factory**: A factory pattern is implemented to support `mock`, `legacy-api`, and `databricks-api` modes, though the latter two currently fall back to mock with warning metadata.
3. **Evidence Completeness**: Section-level completeness summaries are visible in the Chart Overview view.

## Remaining Production Readiness Milestones

To migrate from the sandbox mock mode to a production-ready state, the following validation gates must be passed:
- **Live Data Source Alignment**: Map queries to actual database tables or APIs representing pasteurisation, moisture, fat, salt, and texture measurements.
- **Approved Control-Limits Source**: Interface with an approved repository or calculation service for site/product-specific statistical control limits (`UCL`, `LCL`, `CL`).
- **Control-Rule Validation**: Align the out-of-control alarm logic (e.g., Western Electric or Nelson rules) with Kerry Ingredients Quality Standard Operating Procedures (SOPs).
- **Source Badge Verification**: Verify that the `<EvidencePanel>` badge updates correctly to show `source: 'legacy-api'` or `source: 'databricks-api'` once the connection layer is wired up.
- **Error-State Validation**: Validate how the UI handles network failures, timeout limits, and invalid data responses returned from live backend services.
- **i18n Support**: Introduce localization support for titles and warning strings if required by repository standards.
