# Architecture Regression Check — ConnectIO-RAD V2

**Audit date:** 2026-05-16  
**Triggered by:** Phase 9 remediation — REM-004, REM-005, REM-009, REM-010, REM-012

---

## Checklist

| # | Constraint | Status | Evidence |
|---|-----------|--------|----------|
| 1 | No direct shadcn/Radix imports outside design-system | **PASS** | All changed files use only `EvidencePanel`, `useEvidencePanel`, standard React, and SVG. No `@radix-ui/*` or `shadcn` imports introduced. |
| 2 | No new custom workspace shell | **PASS** | No new workspace, no new shell file, no new workspace registration created. |
| 3 | No panels rendering data outside EvidencePanel | **PASS** | `open-work-orders-panel.tsx` and `open-holds-panel.tsx` both wrap all data output in their existing `<EvidencePanel>` wrapper. The new `AdherenceSparkline` helper in `plan-risk-summary-panel.tsx` renders inside the EvidencePanel body only. |
| 4 | No new adapter bypassing AdapterResult | **PASS** | No new adapters created. `spc-monitoring-adapter.ts` updated to dispatch by `characteristicId` — all branches still return `ok(...)` wrapping `AdapterResult<ControlChartSeries>`. |
| 5 | No new speculative proxy routes | **PASS** | No changes to `apps/api/main.py`, `apps/api/app.yaml`, or any FastAPI route file. |
| 6 | No broad phase/governance expansion | **PASS** | No new phases, governance dashboards, pilot tracking pages, or operational workspaces added. `AdherenceSparkline` is a hardcoded local const — does not extend `PlanRiskSummary` data contract. |
| 7 | No claims of live/browser-verified data unless true | **PASS** | All changed files use mock data. New mock series (`mockMoistureChartSeries`, `mockFatChartSeries`) use 2026-05 dates. No adapter JSDoc changed to claim browser-verified status. |

---

## Files changed in this tranche

| File | Change type | Regression surface |
|------|------------|-------------------|
| `domain-integrations/spc/src/adapters/spc-monitoring-mock-data.ts` | Date normalisation + 2 new mock series | Mock data only; `mockControlChartSeries` unchanged |
| `domain-integrations/spc/src/adapters/spc-signals-mock-data.ts` | Date normalisation | Mock data only |
| `domain-integrations/spc/src/adapters/spc-monitoring-adapter.ts` | Dispatch by `characteristicId` | Preserves default pH path; existing test unchanged |
| `domain-integrations/spc/src/views/chart-overview-view.tsx` | 3 explicit `ControlChartPanel` instances | No new registration; explicit characteristicIds passed |
| `domain-integrations/maintenance/src/adapters/maintenance-reliability-mock-data.ts` | Date normalisation | Mock data only; WO-/PM-/BL- ID strings unchanged |
| `domain-integrations/maintenance/src/panels/open-work-orders-panel.tsx` | Optional `onWorkOrderClick` prop + button wrapper | `registration` const unchanged; `EvidencePanel` wrapper unchanged |
| `domain-integrations/maintenance/src/views/maintenance-overview-view.tsx` | Optional `onNavigateToView` prop threaded | View composition unchanged |
| `domain-integrations/maintenance/src/maintenance-reliability-workspace.tsx` | Optional `onNavigateToView` prop added | `registration` const unchanged |
| `domain-integrations/warehouse/src/adapters/warehouse-360-mock-data.ts` | Date normalisation | Mock data only; HOLD-/GR-/GI-/TO-/ADJ- ID strings unchanged |
| `domain-integrations/warehouse/src/panels/open-holds-panel.tsx` | Optional `onHoldNavigate` prop + clickable workspace link | `registration` const unchanged; `EvidencePanel` wrapper unchanged |
| `domain-integrations/warehouse/src/views/warehouse-overview-view.tsx` | Optional `onHoldNavigate` prop threaded | View composition unchanged |
| `domain-integrations/warehouse/src/views/holds-management-view.tsx` | Optional `onHoldNavigate` prop threaded | View composition unchanged |
| `domain-integrations/warehouse/src/warehouse-360-workspace.tsx` | Optional `onNavigateToWorkspace` prop added | `registration` const unchanged |
| `domain-integrations/operations/src/panels/plan-risk-summary-panel.tsx` | `AdherenceSparkline` component + `ADHERENCE_TREND` const | `registration` const unchanged; hardcoded const, no contract change |
| `apps/web/src/pages/WorkspaceViews.tsx` | Destructure `setView`, `setWorkspace`; pass to workspace components | No new workspace IDs; no new imports |
| `apps/web/src/pages/RoleAwareHome.test.tsx` | Remove unused `waitFor` import | Test file; no logic change |

---

## Detailed constraint checks

### SPC adapter dispatch (REM-004)

- `getControlChartSeries` now branches on `request.characteristicId`:
  - `CHAR-MOISTURE-001` → `mockMoistureChartSeries` (individuals chart, Moisture %)
  - `CHAR-FAT-001` → `mockFatChartSeries` (xbar-r chart, Fat %)
  - undefined or `CHAR-PH-001` → `mockControlChartSeries` (existing default, pH)
- Existing `control-chart-panel.test.tsx` uses request without `characteristicId` → defaults to pH → **passes unchanged**.
- `chart-overview-view.tsx` now passes explicit `characteristicId` to each of 3 `ControlChartPanel` instances.
- `registration` const on `ControlChartPanel`: **unchanged**.

### Maintenance navigation chain (REM-005)

- `onWorkOrderClick` is optional on `OpenWorkOrdersPanel` — backward compatible.
- Work order rows converted to `<button>` elements with `cursor: default` when no handler provided — preserves visual when callback absent.
- Callback propagates: `WorkspaceViews` (`setView`) → `MaintenanceReliabilityWorkspace` → `MaintenanceOverviewView` → `OpenWorkOrdersPanel`.
- Clicking navigates to the 'work-orders' view within the same workspace — no workspace change.

### WH360 hold drill-through (REM-010)

- `onHoldNavigate` is optional on `OpenHoldsPanel` — backward compatible; falls back to plain text when absent.
- Clickable button only shown when both `hold.linkedWorkspaceId` is set AND `onHoldNavigate` is provided.
- Callback propagates: `WorkspaceViews` (`setWorkspace`) → `Warehouse360Workspace` → `WarehouseOverviewView` / `HoldsManagementView` → `OpenHoldsPanel`.
- Clicking calls `setWorkspace(workspaceId)` which navigates to the linked workspace (e.g. `quality-batch-release`, `trace-investigation`).

### Plan Risk sparkline (REM-009)

- `ADHERENCE_TREND` is a hardcoded local const in `plan-risk-summary-panel.tsx` — no extension to `PlanRiskSummary` data contract.
- `AdherenceSparkline` is a private function component; no export added.
- Pure SVG with `polyline` + `circle` + `text` — no external charting library.
- `registration` const: **unchanged**.

### Date normalisation (REM-012)

- All 2024-03-xx and 2024-02-xx ISO timestamp fields normalised to 2026 equivalents across all 4 mock data files.
- ID strings containing "2024" as part of identifiers (WO-2024-xxxxx, PM-2024-xxxxx, BL-2024-xxxxx, HOLD-2024-xxxxx, ALM-2024-xxxxx, SIG-2024-xxxxx, ALARM-2024-xxxxx, GR-2024-xxxxx, GI-2024-xxxxx, TO-2024-xxxxx, ADJ-2024-xxxxx) left unchanged.
- `spc-signals-adapter.test.ts` fixture `const fixedNow = () => '2024-03-08T15:00:00.000Z'` left unchanged — it is a test time fixture, not a display assertion.

---

## Deployment file status

No Databricks deployment files changed. `apps/api/main.py`, `apps/api/app.yaml`, `apps/api/requirements.txt`, and `scripts/prepare-databricks-app.mjs` are **unchanged** from prior state.
