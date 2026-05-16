# Architecture Regression Check — ConnectIO-RAD V2

**Audit date:** 2026-05-16  
**Triggered by:** Functional Preservation and Workspace Depth Tranche (Phase 9 improvements)

---

## Checklist

| # | Constraint | Status | Evidence |
|---|-----------|--------|----------|
| 1 | No direct shadcn/Radix imports outside design-system | **PASS** | All three changed files use only `EvidencePanel`, `useEvidencePanel`, and standard React. No `@radix-ui/*` or `shadcn` imports introduced. |
| 2 | No new custom workspace shell | **PASS** | No new workspace, no new shell file, no new workspace registration created. |
| 3 | No panels rendering data outside EvidencePanel | **PASS** | `control-chart-panel.tsx` and `envmon-trends-panel.tsx` both wrap all data output in their existing `<EvidencePanel>` wrapper. The new `TrendBarsChart` and updated `ChartPlaceholder` helper functions render inside the EvidencePanel body only. |
| 4 | No new adapter bypassing AdapterResult | **PASS** | No new adapters created. No existing adapter modified. All data flows through existing `useControlChartSeries` and `useEnvMonTrends` hooks which return `AdapterResult<T>`. |
| 5 | No new speculative proxy routes | **PASS** | No changes to `apps/api/main.py`, `apps/api/app.yaml`, or any FastAPI route file. |
| 6 | No broad phase/governance expansion | **PASS** | No new phases, governance dashboards, pilot tracking pages, or operational workspaces added. Three audit documents and one regression check document created under `docs/audit/` — all documentation, no product surface. |
| 7 | No claims of live/browser-verified data unless true | **PASS** | All three files use mock data. `RoleAwareHome.tsx` comments remain "mock data" throughout. No adapter JSDoc changed to claim browser-verified status. |

---

## Files changed in this tranche

| File | Change type | Regression surface |
|------|------------|-------------------|
| `domain-integrations/spc/src/panels/control-chart-panel.tsx` | Panel UI improvement | SVG only; existing `registration` const unchanged; `EvidencePanel` wrapper unchanged |
| `domain-integrations/envmon/src/panels/envmon-trends-panel.tsx` | Panel UI improvement | SVG added above existing table; `registration` const unchanged; `EvidencePanel` wrapper unchanged |
| `apps/web/src/pages/RoleAwareHome.tsx` | Shell page improvement | New section added; mock constants added; date strings normalised; `navigateToTraceInvestigation` hook added from existing `useWorkspaceShellState` |
| `docs/audit/functional-preservation-inventory.md` | New doc | Documentation only |
| `docs/audit/workspace-depth-scorecard.md` | New doc | Documentation only |
| `docs/audit/top-remediation-backlog.md` | New doc | Documentation only |
| `docs/audit/architecture-regression-check.md` | New doc | Documentation only |

---

## Detailed panel constraint checks

### control-chart-panel.tsx

- `registration` const: **unchanged** — `panelId`, `lifecycle`, `allowedConsumerWorkspaces`, `freshnessPolicy` all identical to pre-change state.
- `EvidencePanel` wrapper: **unchanged** — `displayState`, `errorMessage` props passed identically.
- Source prop: not present on this panel (not a legacy-api panel) — **correct**, no source badge added speculatively.
- New imports: none.
- New helper function `formatPointDate`: pure string formatting, no external dependencies.
- `ChartPlaceholder` rewrite: larger SVG viewBox, axis labels added, spec-limit lines preserved. No external charting library imported.

### envmon-trends-panel.tsx

- `registration` const: **unchanged**.
- `EvidencePanel` wrapper: **unchanged**.
- New helper functions `barColor` and `TrendBarsChart`: self-contained SVG rendering, no external dependencies.
- Empty state added for `trends.length === 0`: consistent with existing pattern (`"No open work orders."`).
- Existing table: **preserved** below the chart; no columns removed.
- No new imports.

### RoleAwareHome.tsx

- `navigateToTraceInvestigation`: destructured from existing `useWorkspaceShellState` — the hook already provides this function; it was previously unused in this file.
- `MOCK_RECENT_INVESTIGATIONS`: new constant with 2 items, 2026-05 dates, consistent era with `MOCK_ENVMON_ALERTS` and `MOCK_STAGING_SUMMARY`.
- Date normalisation: `MOCK_PLAN_RISK_ITEMS` (2024-03-08/09 → 2026-05-14/15), `MOCK_PRIORITY_RELEASE_ITEMS` (2024-03-09 → 2026-05-15), `MOCK_SPC_SIGNALS` (2024-03-08 → 2026-05-14). Identifier strings (holdId, workOrderId, releaseCaseId, batchId fields that contain years as part of an ID) unchanged.
- `hasTraceInvestigation`: same pattern as `hasBatchRelease`, `hasOperationsPlanRisk`, etc. — no new logic.
- New "Recent Investigations" section: follows identical HTML/CSS pattern as all existing domain sections. No new layout, no new shell component.

---

## Deployment file status

No Databricks deployment files changed. `apps/api/main.py`, `apps/api/app.yaml`, `apps/api/requirements.txt`, and `scripts/prepare-databricks-app.mjs` are **unchanged** from prior state.
