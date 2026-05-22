# Agent Contribution Rules

This repository is building a governed app-facing data product layer. **Agents must not treat prototype app parity as the primary goal.**

## Core Rules

- No new runtime functionality during code freeze.
- No new route without a data-product spec.
- No new field without field classification.
- No new UI consuming live data unless the route/contract/readiness are known.
- No mixed large PRs combining contracts, routes, UI, generated assets, and docs.
- No generated static assets in feature/data-product PRs unless explicitly requested.
- No business decision labels without source/governance.
- No silent mock fallback.
- No UAT or production-readiness claims without evidence.
- Every PR must declare its category.

## PR Categories

When creating PRs, agents must classify the work into one of the following:

- `CI / repo hygiene`
- `ADR / operating model`
- `data-product-spec`
- `source-verification`
- `contract-definition`
- `route-implementation`
- `mapper-test-hardening`
- `reference-consumer-adapter`
- `reference-consumer-ui`
- `readiness-doc-sync`
- `deployment-assets`

## Future Implementation Prompts

Future implementation prompts should start by identifying:

- Data product
- Business object
- Pattern
- Maturity before/after
- Source impact
- Field classifications
- Forbidden claims

## Style Requirements

- Be concise but explicit.
- Use markdown tables where useful.
- Do not overclaim current implementation quality.
- Do not claim browser UAT evidence exists unless provided by the user.
- Do not claim production readiness.
- Do not say existing apps are being migrated. Treat existing apps as prototypes/reference consumers.
