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

// Evidence panels — Phase 3 (Operations Plan Risk)
export { PlanRiskSummaryPanel } from './panels/plan-risk-summary-panel.js'
export type { PlanRiskSummaryPanelProps } from './panels/plan-risk-summary-panel.js'

export { LateOrdersPanel } from './panels/late-orders-panel.js'
export type { LateOrdersPanelProps } from './panels/late-orders-panel.js'

export { MaterialShortagePanel } from './panels/material-shortage-panel.js'
export type { MaterialShortagePanelProps } from './panels/material-shortage-panel.js'

export { LineStatusPanel } from './panels/line-status-panel.js'
export type { LineStatusPanelProps } from './panels/line-status-panel.js'

export { ScheduleAdherencePanel } from './panels/schedule-adherence-panel.js'
export type { ScheduleAdherencePanelProps } from './panels/schedule-adherence-panel.js'

export { YieldVariancePanel } from './panels/yield-variance-panel.js'
export type { YieldVariancePanelProps } from './panels/yield-variance-panel.js'

export { ShiftHandoverPanel } from './panels/shift-handover-panel.js'
export type { ShiftHandoverPanelProps } from './panels/shift-handover-panel.js'

export { OperationsActionQueuePanel } from './panels/operations-action-queue-panel.js'
export type { OperationsActionQueuePanelProps } from './panels/operations-action-queue-panel.js'
