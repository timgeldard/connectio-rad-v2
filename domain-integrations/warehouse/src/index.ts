/**
 * @connectio/di-warehouse
 *
 * Domain integration package for the Warehouse workspace.
 * Phase 2: Warehouse evidence adapter consumed by Quality Batch Release workspace.
 * Phase 4: Production Staging workspace.
 */

export { warehouseWorkspaceRegistration } from './registration.js'

export { WarehouseEvidenceAdapter, warehouseEvidenceAdapter, toAdapterError } from './adapters/warehouse-evidence-adapter.js'
export type { WarehouseEvidenceAdapterRequest, WarehouseEvidenceAdapterOptions } from './adapters/warehouse-evidence-adapter.js'

export { useWarehouseHoldStatus } from './adapters/warehouse-evidence-queries.js'

export {
  WarehouseStagingAdapter,
  warehouseStagingAdapter,
  toStagingAdapterError,
} from './adapters/warehouse-staging-adapter.js'
export type {
  WarehouseStagingAdapterRequest,
  WarehouseStagingAdapterOptions,
} from './adapters/warehouse-staging-adapter.js'

export {
  useWarehouseStagingStatus,
  useMaterialShortagesForPlan,
} from './adapters/warehouse-staging-queries.js'

// Evidence panels
export { WarehouseHoldStatusPanel } from './panels/warehouse-hold-status-panel.js'
export type { WarehouseHoldStatusPanelProps } from './panels/warehouse-hold-status-panel.js'

export { WarehouseStagingStatusPanel } from './panels/warehouse-staging-status-panel.js'
export type { WarehouseStagingStatusPanelProps } from './panels/warehouse-staging-status-panel.js'

// Production Staging workspace
export { productionStagingRegistration } from './production-staging-registration.js'

export { ProductionStagingWorkspace } from './production-staging-workspace.js'
export type { ProductionStagingWorkspaceProps, ProductionStagingViewId } from './production-staging-workspace.js'

export {
  ProductionStagingAdapter,
  productionStagingAdapter,
  toProductionStagingAdapterError,
} from './adapters/production-staging-adapter.js'
export type {
  ProductionStagingAdapterRequest,
  ProductionStagingAdapterOptions,
} from './adapters/production-staging-adapter.js'

export {
  useProductionStagingContext,
  useStagingReadinessSummary,
  useStagingOrderSummaries,
  useStagingPickTasks,
  useStagingZoneCapacity,
  useStagingShortfalls,
  useStagingMoveRequests,
  useStagingPickingWaves,
  useStagingAlerts,
} from './adapters/production-staging-queries.js'

// Production Staging panels
export { StagingReadinessSummaryPanel } from './panels/staging-readiness-summary-panel.js'
export { StagingOrderListPanel } from './panels/staging-order-list-panel.js'
export { StagingPickTasksPanel } from './panels/staging-pick-tasks-panel.js'
export { StagingZoneCapacityPanel } from './panels/staging-zone-capacity-panel.js'
export { StagingShortfallsPanel } from './panels/staging-shortfalls-panel.js'
export { StagingMoveRequestsPanel } from './panels/staging-move-requests-panel.js'
export { StagingPickingWavesPanel } from './panels/staging-picking-waves-panel.js'
export { StagingAlertsPanel } from './panels/staging-alerts-panel.js'

// Production Staging views
export { StagingOverviewView } from './views/staging-overview-view.js'
export { OrderStagingView } from './views/order-staging-view.js'
export { ShortfallsView } from './views/shortfalls-view.js'
export { ZoneCapacityView } from './views/zone-capacity-view.js'
export { PickingWavesView } from './views/picking-waves-view.js'
export { MoveRequestsView } from './views/move-requests-view.js'

// Production Staging actions
export { ProductionStagingActionsPanel } from './actions/production-staging-actions-panel.js'
