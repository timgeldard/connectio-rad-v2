import { StandardWorkspaceTemplate } from '@connectio/workspace-runtime'
import type { ScopeContext } from '@connectio/data-contracts'
import { spcMonitoringRegistration } from './spc-monitoring-registration.js'
import { SPCActionsPanel } from './actions/spc-actions-panel.js'
import { useSPCMonitoringContext } from './adapters/spc-monitoring-queries.js'
import type { SPCMonitoringAdapterRequest } from './adapters/spc-monitoring-adapter.js'
import { ChartOverviewView } from './views/chart-overview-view.js'
import { ActiveSignalsView } from './views/active-signals-view.js'
import { CharacteristicReviewView } from './views/characteristic-review-view.js'
import { CapabilityView } from './views/capability-view.js'
import { AlarmHistoryView } from './views/alarm-history-view.js'
import { ChartConfigurationReadonlyView } from './views/chart-configuration-readonly-view.js'

export type SPCMonitoringViewId =
  | 'chart-overview'
  | 'active-signals'
  | 'characteristic-review'
  | 'capability'
  | 'alarm-history'
  | 'chart-configuration-readonly'

export interface SPCMonitoringWorkspaceProps {
  readonly scope: ScopeContext
  readonly viewId?: string
}

export function SPCMonitoringWorkspace({
  scope,
  viewId = 'chart-overview',
}: SPCMonitoringWorkspaceProps) {
  const request: SPCMonitoringAdapterRequest = {
    plantId: scope.plantId,
    workCentreId: scope.workCentreId,
    materialId: scope.materialId,
    batchId: scope.batchId,
  }

  const { data: contextResult } = useSPCMonitoringContext(request)
  const context = contextResult?.ok ? contextResult.data : null

  return (
    <StandardWorkspaceTemplate
      registration={spcMonitoringRegistration}
      scope={scope}
      defaultViewId={isValidViewId(viewId) ? viewId : 'chart-overview'}
      actionSidebar={<SPCActionsPanel context={context} />}
    >
      {resolveView(viewId, request)}
    </StandardWorkspaceTemplate>
  )
}

function resolveView(viewId: string, request: SPCMonitoringAdapterRequest): React.ReactNode {
  switch (viewId as SPCMonitoringViewId) {
    case 'chart-overview':
      return <ChartOverviewView request={request} />
    case 'active-signals':
      return <ActiveSignalsView request={request} />
    case 'characteristic-review':
      return <CharacteristicReviewView request={request} />
    case 'capability':
      return <CapabilityView request={request} />
    case 'alarm-history':
      return <AlarmHistoryView request={request} />
    case 'chart-configuration-readonly':
      return <ChartConfigurationReadonlyView request={request} />
    default:
      return <ChartOverviewView request={request} />
  }
}

function isValidViewId(viewId: string): viewId is SPCMonitoringViewId {
  const valid: SPCMonitoringViewId[] = [
    'chart-overview',
    'active-signals',
    'characteristic-review',
    'capability',
    'alarm-history',
    'chart-configuration-readonly',
  ]
  return valid.includes(viewId as SPCMonitoringViewId)
}
