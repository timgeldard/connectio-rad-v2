/**
 * @connectio/di-operations
 *
 * Domain integration package for the Operations workspace.
 * Phase 2: Operations evidence adapter consumed by Quality Batch Release workspace.
 * Phase 3: Operations Plan Risk workspace — full implementation.
 */

export { operationsWorkspaceRegistration } from './registration.js'

export { OperationsEvidenceAdapter, operationsEvidenceAdapter, toAdapterError } from './adapters/operations-evidence-adapter.js'
export type { OperationsEvidenceAdapterRequest, OperationsEvidenceAdapterOptions } from './adapters/operations-evidence-adapter.js'

export { useProcessOrderEvidence } from './adapters/operations-evidence-queries.js'

export {
  OperationsPlanRiskAdapter,
  operationsPlanRiskAdapter,
  toAdapterError as toPlanRiskAdapterError,
} from './adapters/operations-plan-risk-adapter.js'
export type {
  OperationsPlanRiskAdapterRequest,
  OperationsPlanRiskAdapterOptions,
} from './adapters/operations-plan-risk-adapter.js'

export {
  useOperationsPlanRiskContext,
  usePlanRiskSummary,
  useLateOrders,
  useMaterialShortages,
  useLineStatus,
  useScheduleAdherenceSummary,
  useYieldVarianceSummary,
  useShiftHandoverItems,
  useOperationsActionQueue,
} from './adapters/operations-plan-risk-queries.js'

// Evidence panels — Phase 2 (consumed by Batch Release)
export { ProcessOrderEvidencePanel } from './panels/process-order-evidence-panel.js'
export type { ProcessOrderEvidencePanelProps } from './panels/process-order-evidence-panel.js'
