# Statistical Process Control (SPC) Domain Integration

This directory houses the SPC domain-integration components, including adapters, queries, views, workspaces, and Evidence Panels.

## Current Readiness & Source Status

- **Current Source Mode**: Sandbox / Simulated Mock Data (`source: 'mock'`).
- **Data Veracity**: Simulated data for workflow and UI layout validation. These values and charts are **not** production control evidence.
- **Regulatory Status**: Do **not** use the limits, centrelines, or warning signals rendered in this sandbox for regulatory decisions or real-time process monitoring. Control limits and signals must be validated against approved site-specific SPC rules before operational deployment.

## Integration Gates & Out-of-Scope Items

1. **Native Databricks Execution**: Native Databricks SPC execution is out of scope for the current design phase.
2. **Verification Status**: No live Databricks database, actual browser-based user acceptance testing (UAT), or live endpoint validation has been performed or claimed for this domain. All components run using mock representations of the adapter response contract.

## Remaining Production Readiness Milestones

To migrate from the sandbox mock mode to a production-ready state, the following validation gates must be passed:
- **Live Data Source Alignment**: Map queries to actual database tables or APIs representing pasteurisation, moisture, fat, salt, and texture measurements.
- **Approved Control-Limits Source**: Interface with an approved repository or calculation service for site/product-specific statistical control limits (`UCL`, `LCL`, `CL`).
- **Control-Rule Validation**: Align the out-of-control alarm logic (e.g., Western Electric or Nelson rules) with Kerry Ingredients Quality Standard Operating Procedures (SOPs).
- **Source Badge Verification**: Verify that the `<EvidencePanel>` badge updates correctly to show `source: 'legacy-api'` or `source: 'databricks-api'` once the connection layer is wired up.
- **Error-State Validation**: Validate how the UI handles network failures, timeout limits, and invalid data responses returned from live backend services.
- **i18n Support**: Introduce localization support for titles and warning strings if required by repository standards.
