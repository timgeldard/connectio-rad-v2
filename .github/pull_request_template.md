<!--
App data layer and consumer application PR template — enforces the operating model from
docs/product-operating-model/consumer-grade-app-direction.md and the contribution rules.

Fill in every section. PRs that leave sections blank or claim readiness
without evidence will be requested-changes.
-->

## PR Category

<!-- Choose ONE. PRs that span multiple categories must be split. -->

- [ ] `consumer-application`
- [ ] `governed-data-product`
- [ ] `design-system`
- [ ] `readiness-evidence`
- [ ] `repo-hygiene`
- [ ] `deployment-assets`

---

## Application Impacted

- App name: <!-- e.g. Trace Consumer, SPC Monitoring -->
- Primary user: <!-- e.g. Food Safety Lead, Plant Operator -->
- User job / workflow: <!-- e.g. Batch origin investigation -->
- Application Maturity (A0-A6):
  | Axis | Before | After |
  |---|---|---|
  | App Experience Maturity | | |

---

## Data Products Impacted

<!-- Name(s) from docs/app-data-layer/domain-data-product-catalog.md. Write
"none" only if the PR is `repo-hygiene` or `deployment-assets`. -->

- Data product name: <!-- e.g. SPCSubgroupSeries -->
- Business object: <!-- e.g. SPC inspection batch -->
- Data-product maturity (D0-D6):
  | Axis | Before | After |
  |---|---|---|
  | Data Product Maturity | | |
- Source impact: <!-- Databricks gold objects touched and their live verification state -->

---

## Governance & Caveat Handling

- Any governance-pending semantics? <!-- Yes/No - list fields -->
- Any heuristic fields? <!-- Yes/No - list fields -->
- Any unavailable fields? <!-- Yes/No - list fields -->
- How are caveats surfaced to the user? <!-- e.g. Status banner on page, warning tooltips -->

---

## Field Classifications Confirmation

- [ ] All new schema fields are classified (`.describe('[classification: X]')`)
- [ ] No `application-heuristic` field is rendered as a governed value in the UI
- [ ] No field defaults to a unit/value the source does not provide (no invented UOMs)
- [ ] No silent mock fallback in non-mock adapter modes

---

## UX & Readiness Confirmation

- [ ] Empty, loading, error, stale, and partial states are considered and handled in the UX
- [ ] Browser UAT evidence captured or explicitly pending
- [ ] No production-readiness claim without evidence
- [ ] No recall, release, reject, or e-signature decision claim without governed source semantics

---

## Tests Run

<!-- List the test targets actually run locally (or via CI) for this PR. -->

```text
# fill in: e.g.
# npx nx run-many -t lint typecheck test --projects=di-spc,web
```
