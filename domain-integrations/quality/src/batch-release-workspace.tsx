import { StandardWorkspaceTemplate } from '@connectio/workspace-runtime'
import type { ScopeContext } from '@connectio/data-contracts'
import { batchReleaseRegistration } from './batch-release-registration.js'
import { ReleaseActionsPanel } from './actions/release-actions-panel.js'
import { ReleaseQueueView } from './views/release-queue-view.js'
import { BatchDecisionView } from './views/batch-decision-view.js'
import { QualityEvidenceView } from './views/quality-evidence-view.js'
import { OperationsEvidenceView } from './views/operations-evidence-view.js'
import { WarehouseTraceEvidenceView } from './views/warehouse-trace-evidence-view.js'
import { DecisionHistoryView } from './views/decision-history-view.js'
import { LabBoardView } from './views/lab-board-view.js'
import { useReleaseContext } from './adapters/quality-release-queries.js'
import type { QualityReleaseAdapterRequest } from './adapters/quality-release-adapter.js'
import type { Trace2AdapterRequest } from '@connectio/di-traceability'
import type { OperationsEvidenceAdapterRequest } from '@connectio/di-operations'
import type { WarehouseEvidenceAdapterRequest } from '@connectio/di-warehouse'

/** Valid view identifiers for the Quality Batch Release workspace. */
export type BatchReleaseViewId =
  | 'release-queue'
  | 'batch-decision'
  | 'quality-evidence'
  | 'operations-evidence'
  | 'warehouse-trace-evidence'
  | 'decision-history'
  | 'lab-board'

/** Props for BatchReleaseWorkspace. */
export interface BatchReleaseWorkspaceProps {
  /**
   * Active scope context provided by the host shell.
   * Used to derive batch/plant/process-order context for cross-domain panels.
   */
  readonly scope: ScopeContext
  /**
   * The release case ID from the URL. Defaults to the mock case ID
   * when not provided — enables the workspace to render without a real backend.
   */
  readonly releaseCaseId?: string
  /**
   * Active view tab. Defaults to 'release-queue'.
   */
  readonly viewId?: string
  /**
   * Called when the user selects a different release case from the queue.
   * The shell wires this to its URL state updater.
   */
  readonly onSelectCase?: (releaseCaseId: string) => void
}

/**
 * Top-level component for the Quality Batch Release workspace.
 *
 * @remarks
 * Uses `StandardWorkspaceTemplate` as the mandatory layout wrapper. The active
 * view is determined by `viewId` and rendered inside the template's evidence
 * grid body. The right-hand action sidebar is pre-wired with release action
 * flows (release, hold, retest, escalate, open-trace).
 *
 * Cross-domain adapter requests are derived from `scope` and `releaseCaseId`
 * and forwarded to every view. Each domain's adapter provides its own mock
 * data in Phase 2 — no real backend connection is required.
 *
 * Phase 2: uses realistic mock data. No real backend connection required.
 */
export function BatchReleaseWorkspace({
  scope,
  releaseCaseId = 'RC-2024-001847',
  viewId = 'release-queue',
  onSelectCase,
}: BatchReleaseWorkspaceProps) {
  const qualityRequest: QualityReleaseAdapterRequest = {
    releaseCaseId,
    batchId: scope.batchId,
    plantId: scope.plantId,
  }

  const traceRequest: Trace2AdapterRequest = {
    investigationId: `trace-for-${releaseCaseId}`,
    batchId: scope.batchId,
    plantId: scope.plantId,
  }

  const operationsRequest: OperationsEvidenceAdapterRequest = {
    processOrderId: scope.processOrderId,
    batchId: scope.batchId,
    releaseCaseId,
  }

  const warehouseRequest: WarehouseEvidenceAdapterRequest = {
    batchId: scope.batchId,
    plantId: scope.plantId,
    releaseCaseId,
  }

  const { data: contextResult } = useReleaseContext(qualityRequest)
  const context = contextResult?.ok ? contextResult.data : null

  const activeView = resolveView(viewId, {
    qualityRequest,
    traceRequest,
    operationsRequest,
    warehouseRequest,
    onSelectCase,
    activeCaseId: releaseCaseId,
  })

  return (
    <StandardWorkspaceTemplate
      registration={batchReleaseRegistration}
      scope={scope}
      defaultViewId={isValidViewId(viewId) ? viewId : 'release-queue'}
      actionSidebar={<ReleaseActionsPanel context={context} />}
    >
      {activeView}
    </StandardWorkspaceTemplate>
  )
}

/** All request objects needed by views. */
interface ViewRequests {
  qualityRequest: QualityReleaseAdapterRequest
  traceRequest: Trace2AdapterRequest
  operationsRequest: OperationsEvidenceAdapterRequest
  warehouseRequest: WarehouseEvidenceAdapterRequest
  onSelectCase?: (releaseCaseId: string) => void
  activeCaseId?: string
}

/**
 * Maps a viewId string to the corresponding React view component.
 *
 * @param viewId - The raw view ID string from the URL.
 * @param requests - All adapter request contexts forwarded to the view.
 * @returns The view component, or ReleaseQueueView as the default fallback.
 */
function resolveView(viewId: string, requests: ViewRequests): React.ReactNode {
  const { qualityRequest, traceRequest, operationsRequest, warehouseRequest, onSelectCase, activeCaseId } = requests

  switch (viewId as BatchReleaseViewId) {
    case 'release-queue':
      return (
        <ReleaseQueueView
          request={qualityRequest}
          onSelectCase={onSelectCase}
          activeCaseId={activeCaseId}
        />
      )
    case 'batch-decision':
      return <BatchDecisionView request={qualityRequest} />
    case 'quality-evidence':
      return (
        <QualityEvidenceView
          qualityRequest={qualityRequest}
          traceRequest={traceRequest}
        />
      )
    case 'operations-evidence':
      return (
        <OperationsEvidenceView
          qualityRequest={qualityRequest}
          operationsRequest={operationsRequest}
          warehouseRequest={warehouseRequest}
          traceRequest={traceRequest}
        />
      )
    case 'warehouse-trace-evidence':
      return (
        <WarehouseTraceEvidenceView
          warehouseRequest={warehouseRequest}
          traceRequest={traceRequest}
          qualityRequest={qualityRequest}
        />
      )
    case 'decision-history':
      return <DecisionHistoryView request={qualityRequest} />
    case 'lab-board':
      return <LabBoardView request={{ plantId: qualityRequest.plantId }} />
    default:
      return (
        <ReleaseQueueView
          request={qualityRequest}
          onSelectCase={onSelectCase}
          activeCaseId={activeCaseId}
        />
      )
  }
}

/** Type guard for valid BatchReleaseViewId values. */
function isValidViewId(viewId: string): viewId is BatchReleaseViewId {
  const valid: BatchReleaseViewId[] = [
    'release-queue',
    'batch-decision',
    'quality-evidence',
    'operations-evidence',
    'warehouse-trace-evidence',
    'decision-history',
    'lab-board',
  ]
  return valid.includes(viewId as BatchReleaseViewId)
}
