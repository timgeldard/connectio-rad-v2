/**
 * @connectio/di-maintenance
 *
 * Domain integration package for the Maintenance workspace.
 * Phase 3: MaintenanceConstraintsAdapter for Operations Plan Risk cross-domain evidence.
 */

export { maintenanceWorkspaceRegistration } from './registration.js'

export {
  MaintenanceConstraintsAdapter,
  maintenanceConstraintsAdapter,
  toMaintenanceAdapterError,
} from './adapters/maintenance-constraints-adapter.js'
export type {
  MaintenanceConstraintsAdapterRequest,
  MaintenanceConstraintsAdapterOptions,
} from './adapters/maintenance-constraints-adapter.js'

export { useMaintenanceConstraints } from './adapters/maintenance-constraints-queries.js'

// Evidence panels
export { MaintenanceConstraintPanel } from './panels/maintenance-constraint-panel.js'
export type { MaintenanceConstraintPanelProps } from './panels/maintenance-constraint-panel.js'
