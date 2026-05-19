# di-traceability

Batch traceability investigation cockpit for the ConnectIO V2 platform.

Gives quality and food-safety users a single view of a suspect batch: what it is, where it came from, what it went into, which customers may be exposed, what stock remains, and what evidence is complete or missing.

## Architecture

```
trace2-queries.ts       TanStack Query hooks (one per data domain)
       │
trace2-adapter.ts       Adapter facade — returns AdapterResult<T> ({ ok, data } | { ok, error })
       │
trace2-adapter-factory  Selects mock or legacy-api adapter based on config
       │
trace2-mock-data.ts     Realistic mock responses (Phase 1 fixture)
```

### Views and panels

- **`views/overview-view.tsx`** — Main investigation cockpit: `InvestigationSummary` header + 6 evidence panels + `EvidencePackReadiness` checklist
- **`views/trace-tree-view.tsx`** — Bidirectional lineage graph
- **`views/customer-exposure-view.tsx`** — Delivery and customer exposure detail
- **`views/supplier-exposure-view.tsx`** — Upstream vendor/receipt exposure
- **`views/mass-balance-view.tsx`** — Input/output variance
- **`views/recall-readiness-view.tsx`** — Recall risk assessment

Panels are stateless cards (≥320px) that accept a `Trace2AdapterRequest` and render a single data domain.

### Evidence confidence

`calculateConfidence()` in `components/EvidenceConfidence.tsx` scores evidence completeness across 6 sectors (lineage, customers, mass balance, quality, CoA, suppliers) and drives the `EvidenceConfidenceBadge` and `EvidencePackReadiness` checklist on the cockpit.

## Running tests

```sh
pnpm nx test di-traceability
pnpm nx typecheck di-traceability
```

## Key docs

| Doc | Purpose |
|-----|---------|
| `docs/mb56-parity-review.md` | Gap analysis vs. reference SQL engine |
| `docs/uat-acceptance-script.md` | 10 UAT scenarios for QA / food-safety users |
| `docs/golden-test-batches.md` | Register of known test batches |
| `docs/uat-validation-ledger.md` | Live UAT run history |
| `docs/traceability-defect-backlog.md` | Classified defect register |
| `docs/production-readiness-checklist.md` | Gates before production use |

## Status

Phase 1 — mock data only. No live Databricks or legacy-api connection has been browser-verified. See `docs/production-readiness-checklist.md` for open gates.
