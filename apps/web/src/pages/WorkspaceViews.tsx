import { TraceInvestigationWorkspace } from '@connectio/di-traceability'
import { BatchReleaseWorkspace } from '@connectio/di-quality'
import { OperationsPlanRiskWorkspace, ProcessOrderReviewWorkspace } from '@connectio/di-operations'
import { EnvMonWorkspace } from '@connectio/di-envmon'
import { ProductionStagingWorkspace, Warehouse360Workspace } from '@connectio/di-warehouse'
import { SPCMonitoringWorkspace } from '@connectio/di-spc'
import { MaintenanceReliabilityWorkspace } from '@connectio/di-maintenance'
import { useWorkspaceShellState } from '../shell/useWorkspaceShellState.js'
import { useAuthScope } from '@connectio/auth-scope'

/** Props for the workspace view renderer. */
interface Props {
  /** The id of the workspace to render, matched against the registry. */
  readonly workspaceId: string
}

/**
 * Workspace content renderer.
 *
 * @remarks
 * Routes to the appropriate workspace component based on `workspaceId`.
 * Phase 1: trace-investigation. Phase 2: quality-batch-release.
 * Phase 3: operations-plan-risk. Phase 4: envmon-monitoring, production-staging.
 * All other workspace IDs render a placeholder until implemented.
 *
 * The `scope` from `useAuthScope()` and URL params (`investigationId`,
 * `releaseCaseId`, `planDate`, `viewId`) are forwarded to workspace components
 * that require them.
 *
 * @param props - Component props.
 */
export default function WorkspaceViews({ workspaceId }: Props) {
  const { investigationId, releaseCaseId, planDate, viewId, setReleaseCaseId, navigateToBatchRelease } =
    useWorkspaceShellState()
  const { activeScope } = useAuthScope()

  if (workspaceId === 'trace-investigation') {
    return (
      <div className="connectio-page" data-testid="workspace-view-trace-investigation">
        <TraceInvestigationWorkspace
          scope={activeScope}
          investigationId={investigationId ?? undefined}
          viewId={viewId ?? 'overview'}
        />
      </div>
    )
  }

  if (workspaceId === 'quality-batch-release') {
    return (
      <div className="connectio-page" data-testid="workspace-view-quality-batch-release">
        <BatchReleaseWorkspace
          scope={activeScope}
          releaseCaseId={releaseCaseId ?? undefined}
          viewId={viewId ?? 'release-queue'}
          onSelectCase={setReleaseCaseId}
        />
      </div>
    )
  }

  if (workspaceId === 'operations-plan-risk') {
    return (
      <div className="connectio-page" data-testid="workspace-view-operations-plan-risk">
        <OperationsPlanRiskWorkspace
          scope={activeScope}
          planDate={planDate ?? undefined}
          viewId={viewId ?? 'plan-overview'}
          onNavigateToBatchRelease={navigateToBatchRelease}
        />
      </div>
    )
  }

  if (workspaceId === 'envmon-monitoring') {
    return (
      <div className="connectio-page" data-testid="workspace-view-envmon-monitoring">
        <EnvMonWorkspace
          scope={activeScope}
          viewId={viewId ?? 'scope-overview'}
        />
      </div>
    )
  }

  if (workspaceId === 'production-staging') {
    return (
      <div className="connectio-page" data-testid="workspace-view-production-staging">
        <ProductionStagingWorkspace
          scope={activeScope}
          planDate={planDate ?? undefined}
          viewId={viewId ?? 'staging-overview'}
        />
      </div>
    )
  }

  if (workspaceId === 'spc-monitoring') {
    return (
      <div className="connectio-page" data-testid="workspace-view-spc-monitoring">
        <SPCMonitoringWorkspace
          scope={activeScope}
          viewId={viewId ?? 'chart-overview'}
        />
      </div>
    )
  }

  if (workspaceId === 'warehouse-360-overview') {
    return (
      <div className="connectio-page" data-testid="workspace-view-warehouse-360-overview">
        <Warehouse360Workspace
          scope={activeScope}
          viewId={viewId ?? 'warehouse-overview'}
        />
      </div>
    )
  }

  if (workspaceId === 'process-order-review') {
    return (
      <div className="connectio-page" data-testid="workspace-view-process-order-review">
        <ProcessOrderReviewWorkspace
          scope={activeScope}
          viewId={viewId ?? 'order-overview'}
        />
      </div>
    )
  }

  if (workspaceId === 'maintenance-reliability') {
    return (
      <div className="connectio-page" data-testid="workspace-view-maintenance-reliability">
        <MaintenanceReliabilityWorkspace
          scope={activeScope}
          viewId={viewId ?? 'overview'}
        />
      </div>
    )
  }

  return (
    <div className="connectio-page" data-testid={`workspace-view-${workspaceId}`}>
      <div style={{ padding: 32, color: 'var(--shell-fg-2)', fontSize: 13 }}>
        Workspace{' '}
        <strong style={{ color: 'var(--shell-fg)' }}>{workspaceId}</strong> —
        implementation pending (Phase 3+).
      </div>
    </div>
  )
}
