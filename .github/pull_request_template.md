<!--
App data layer PR template — enforces the operating model from
docs/app-data-layer/agent-contribution-rules.md and the ADR.

Fill in every section. PRs that leave sections blank or claim readiness
without evidence will be requested-changes.
-->

## PR Category

<!-- Choose ONE. PRs that span multiple categories must be split. -->

- [ ] `ci-repo-hygiene`
- [ ] `adr-operating-model`
- [ ] `data-product-spec`
- [ ] `source-verification`
- [ ] `contract-definition`
- [ ] `route-implementation`
- [ ] `mapper-test-hardening`
- [ ] `reference-consumer-adapter`
- [ ] `reference-consumer-ui`
- [ ] `readiness-doc-sync`
- [ ] `deployment-assets`

## Data Product Impacted

<!-- Name(s) from docs/app-data-layer/domain-data-product-catalog.md. Write
"none" only if the PR is `ci-repo-hygiene` or `adr-operating-model`. -->

- Data product: <!-- e.g. SPCSubgroupSeries -->
- Business object: <!-- e.g. SPC inspection batch -->
- Data-product pattern: <!-- evidence-pack / read-model / metric-view / etc -->

## Maturity Before/After

<!-- See docs/app-data-layer/data-product-maturity-model.md. Use the
exact level names (concept-lab / source-verified / contract-defined /
route-implemented / mapper-tested / reference-consumer / browser-uat /
governed). -->

| | Before | After |
|---|---|---|
| Maturity level | | |

## Source Impact

<!-- Which Databricks gold objects does this PR depend on? Mark each as
verified-in-uat / pending-verification / not-yet-exists. -->

- [ ] No source impact (template / docs only)
- Sources touched:
  - `gold_<...>` — verified / pending / not-yet-exists

## Field Classifications

<!-- Every new schema field MUST carry a `.describe('[classification: X]')`
marker from {source-field, source-derived, application-derived,
application-heuristic, governed}. Confirm: -->

- [ ] All new schema fields are classified
- [ ] No `application-heuristic` field is rendered as a governed value in the UI
- [ ] No field defaults to a unit/value the source does not provide (e.g. no `"KG"` defaults)

## Forbidden Claims Checklist

<!-- The PR must NOT do any of the following. Tick each box to confirm. -->

- [ ] No silent mock fallback in non-mock adapter modes
- [ ] No `recallRecommended: false` (or equivalent) without governed source
- [ ] No `status: 'delivered'` (or equivalent operational status) without governed source
- [ ] No `'in-control'` claim without governed signal source
- [ ] No usage-decision evidence relabelled as `signoff` / `approved` / `e-signature`
- [ ] No heuristic score presented as a governed metric
- [ ] No invented UOM defaults
- [ ] No SAP write-back, release/reject mutation, or e-signature workflow
- [ ] No browser UAT or production-readiness claim without evidence captured in the PR body

## Tests Run

<!-- List the test targets actually run locally (or via CI) for this PR. -->

```text
# fill in: e.g.
# npx nx run-many -t lint typecheck test --projects=di-traceability,data-contracts
# uv run --project apps/api python -m pytest apps/api/tests/routes/test_<route>.py
```

## Readiness Status

<!-- Use the readiness vocabulary from docs/app-data-layer/route-readiness-standard.md.
Multi-select is allowed. -->

- [ ] `code-fixed` — the source code change is complete
- [ ] `source-verified` — gold object existence/columns verified live
- [ ] `contract-defined` — Zod schema + generated Pydantic
- [ ] `mapper-tested` — direct unit tests on the row mapper
- [ ] `route-implemented` — FastAPI route + `response_model` enforced
- [ ] `browser-uat-pending` — no end-to-end browser test captured yet
- [ ] `governance-pending` — recall rules / approval / e-signature semantics still TBD
- [ ] `production-blocked` — explicit reason(s) below

Production-blocked reasons (if checked):
<!-- e.g. mergeable=false, CI red, browser UAT not captured, source caveats unresolved -->

## Generated Assets

<!-- Generated files (apps/api/contracts/generated.py,
packages/data-contracts/dist-schema/contracts.json, apps/api/static/**)
must be committed only when intentional and noted here. -->

- [ ] No generated assets in this PR
- [ ] `apps/api/contracts/generated.py` regenerated and committed (sync-pydantic ran)
- [ ] `packages/data-contracts/dist-schema/contracts.json` regenerated and committed
- [ ] `apps/api/static/**` built bundles regenerated and committed — explain why:
      <!-- only commit static assets when explicitly required for a deploy slice -->

## Notes for Reviewer

<!-- Anything reviewer should know: known caveats, follow-on work, browser UAT
plan, expected CI status, etc. Be terse. Do not overclaim. -->

