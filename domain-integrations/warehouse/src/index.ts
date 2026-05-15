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
