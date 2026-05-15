/**
 * @connectio/di-operations
 *
 * Domain integration package for the Operations workspace.
 * Phase 2: Operations evidence adapter consumed by Quality Batch Release workspace.
 */

export { operationsWorkspaceRegistration } from './registration.js'

export { OperationsEvidenceAdapter, operationsEvidenceAdapter, toAdapterError } from './adapters/operations-evidence-adapter.js'
export type { OperationsEvidenceAdapterRequest, OperationsEvidenceAdapterOptions } from './adapters/operations-evidence-adapter.js'

export { useProcessOrderEvidence } from './adapters/operations-evidence-queries.js'

// Evidence panels
export { ProcessOrderEvidencePanel } from './panels/process-order-evidence-panel.js'
export type { ProcessOrderEvidencePanelProps } from './panels/process-order-evidence-panel.js'
