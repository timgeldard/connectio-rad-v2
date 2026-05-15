/**
 * @connectio/di-warehouse
 *
 * Domain integration package for the Warehouse workspace.
 * Phase 2: Warehouse evidence adapter consumed by Quality Batch Release workspace.
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
