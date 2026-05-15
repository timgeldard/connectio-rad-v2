import { usePinnedWorkspaces } from '@connectio/personalization'
import { isNavigable } from '@connectio/product-model'
import { workspaceRegistry } from '../registry/workspace-registry.js'
import { useWorkspaceShellState } from '../shell/useWorkspaceShellState.js'

/** Maps severity to display colour. */
function severityColor(severity: string): string {
  if (severity === 'critical') return '#DC2626'
  if (severity === 'high') return '#D97706'
  if (severity === 'medium') return '#CA8A04'
  return 'var(--shell-fg-3)'
}

/** Maps risk status to a display colour. */
function riskStatusColor(status: string): string {
  if (status === 'critical') return '#DC2626'
  if (status === 'at-risk') return '#D97706'
  if (status === 'on-track') return '#16A34A'
  return 'var(--shell-fg-3)'
}

/**
 * Mock plan risk items shown in the Operations section.
 * Surfaced from the same mock data as the OperationsPlanRiskAdapter.
 * In production this would be driven by an API call.
 */
const MOCK_PLAN_RISK_ITEMS = [
  {
    planDate: '2024-03-08',
    plantId: 'IE10',
    plantName: 'Kerry Listowel',
    riskStatus: 'critical' as const,
    openBlockers: 5,
    lateOrders: 3,
    topRiskReason: 'Block press breakdown on L-04 blocking 2 process orders',
    supervisor: 'Aoife Murphy',
  },
  {
    planDate: '2024-03-09',
    plantId: 'IE10',
    plantName: 'Kerry Listowel',
    riskStatus: 'at-risk' as const,
    openBlockers: 2,
    lateOrders: 1,
    topRiskReason: 'Brine cooler PM on L-02 scheduled during shift — monitor throughput',
    supervisor: 'Aoife Murphy',
  },
] as const

/**
 * Mock priority release items shown in the Quality section.
 * These are surfaced from the same mock data as the QualityReleaseAdapter.
 * In production this would be driven by an API call.
 */
const MOCK_PRIORITY_RELEASE_ITEMS = [
  {
    releaseCaseId: 'RC-2024-001847',
    batchId: 'CH-240308-0047',
    material: 'Kerry Listowel Emmental',
    plant: 'Kerry Listowel',
    priority: 'critical' as const,
    status: 'under-review' as const,
    dueBy: '2024-03-09T12:00:00.000Z',
  },
  {
    releaseCaseId: 'RC-2024-001831',
    batchId: 'GC-240307-0091',
    material: 'Gouda Classic 5kg',
    plant: 'Kerry Listowel',
    priority: 'expedited' as const,
    status: 'awaiting-review' as const,
    dueBy: '2024-03-09T18:00:00.000Z',
  },
] as const

/** Maps release priority to a display colour. */
function priorityColor(priority: string): string {
  if (priority === 'critical') return '#DC2626'
  if (priority === 'expedited') return '#D97706'
  return 'var(--shell-fg-3)'
}

/**
 * Mock active environmental monitoring alerts surfaced on the home screen.
 * Mirrors the envmon mock data for Kerry Listowel (IE10).
 */
const MOCK_ENVMON_ALERTS = [
  {
    alertId: 'ALT-IE10-001',
    plantId: 'IE10',
    plantName: 'Kerry Listowel',
    zoneId: 'ZONE-05',
    organism: 'Listeria monocytogenes',
    severity: 'critical' as const,
    status: 'under-investigation' as const,
    detectedAt: '2026-05-13T14:32:00Z',
    description: 'Positive Listeria detection in high-risk Zone 5 — investigation active',
  },
  {
    alertId: 'ALT-IE10-002',
    plantId: 'IE10',
    plantName: 'Kerry Listowel',
    zoneId: 'ZONE-04',
    organism: 'Listeria innocua',
    severity: 'high' as const,
    status: 'corrective-action' as const,
    detectedAt: '2026-05-11T09:15:00Z',
    description: 'Consecutive positives in Zone 4 — corrective action in progress',
  },
] as const

/**
 * Mock production staging readiness summary surfaced on the home screen.
 * Mirrors the production staging mock data for WH-IE10-01.
 */
const MOCK_STAGING_SUMMARY = {
  warehouseId: 'WH-IE10-01',
  warehouseName: 'Listowel Main Warehouse',
  planDate: '2026-05-15',
  riskStatus: 'at-risk' as const,
  totalOrders: 18,
  percentReady: 66.7,
  openShortfalls: 2,
  pendingPickTasks: 4,
  openMoveRequests: 2,
} as const

/**
 * Home screen rendered when no workspace is active in the URL.
 *
 * @remarks
 * Displays the user's pinned, navigable workspaces as clickable cards. When
 * `pinnedWorkspaces` is null (not yet loaded or no pins set) the full set of
 * navigable workspaces is shown instead, providing a sensible fallback.
 *
 * A "Priority Items — Batch Release" section is shown below the workspace
 * cards when quality-batch-release is in the navigable set. It surfaces the
 * two highest-priority mock cases so quality users can drill straight in.
 */
export function RoleAwareHome() {
  const {
    setWorkspace,
    navigateToBatchRelease,
    navigateToOperationsPlanRisk,
    navigateToEnvMon,
    navigateToProductionStaging,
  } = useWorkspaceShellState()
  const [pinnedWorkspaces] = usePinnedWorkspaces(workspaceRegistry.map(w => w.workspaceId))

  const pinned = workspaceRegistry.filter(
    w =>
      isNavigable(w.lifecycle) &&
      (pinnedWorkspaces === null || pinnedWorkspaces.includes(w.workspaceId)),
  )

  const hasBatchRelease = workspaceRegistry.some(
    w => w.workspaceId === 'quality-batch-release' && isNavigable(w.lifecycle),
  )

  const hasOperationsPlanRisk = workspaceRegistry.some(
    w => w.workspaceId === 'operations-plan-risk' && isNavigable(w.lifecycle),
  )

  const hasEnvMon = workspaceRegistry.some(
    w => w.workspaceId === 'envmon-monitoring' && isNavigable(w.lifecycle),
  )

  const hasProductionStaging = workspaceRegistry.some(
    w => w.workspaceId === 'production-staging' && isNavigable(w.lifecycle),
  )

  return (
    <div style={{ padding: '32px 40px', maxWidth: 960 }}>
      <h1
        style={{
          margin: '0 0 4px',
          fontSize: 22,
          fontWeight: 600,
          color: 'var(--shell-fg)',
        }}
      >
        My Work
      </h1>
      <p
        style={{
          margin: '0 0 32px',
          fontSize: 13,
          color: 'var(--shell-fg-2)',
        }}
      >
        Select a workspace to get started.
      </p>

      {pinned.length > 0 && (
        <section>
          <h2
            style={{
              margin: '0 0 12px',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--shell-fg-3)',
            }}
          >
            Workspaces
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 12,
            }}
          >
            {pinned.map(w => (
              <button
                key={w.workspaceId}
                type="button"
                onClick={() => setWorkspace(w.workspaceId)}
                style={{
                  padding: '16px',
                  background: 'var(--shell-surface)',
                  border: '1px solid var(--shell-line)',
                  borderRadius: 6,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div
                  style={{
                    fontWeight: 500,
                    fontSize: 13,
                    color: 'var(--shell-fg)',
                  }}
                >
                  {w.displayName}
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 11,
                    color: 'var(--shell-fg-3)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  {w.lifecycle}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Quality section — shown when quality-batch-release is navigable */}
      {hasBatchRelease && (
        <section style={{ marginTop: 32 }}>
          <h2
            style={{
              margin: '0 0 12px',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--shell-fg-3)',
            }}
          >
            Priority Items — Batch Release
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 680 }}>
            {MOCK_PRIORITY_RELEASE_ITEMS.map(item => (
              <button
                key={item.releaseCaseId}
                type="button"
                onClick={() => navigateToBatchRelease(item.releaseCaseId, 'batch-decision')}
                style={{
                  padding: '12px 16px',
                  background: 'var(--shell-surface)',
                  border: '1px solid var(--shell-line)',
                  borderLeft: `3px solid ${priorityColor(item.priority)}`,
                  borderRadius: 6,
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                }}
                aria-label={`Open release case ${item.releaseCaseId} for ${item.material}`}
              >
                <div>
                  <div
                    style={{
                      fontWeight: 500,
                      fontSize: 13,
                      color: 'var(--shell-fg)',
                    }}
                  >
                    {item.material}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginTop: 2 }}>
                    {item.batchId} · {item.plant} · {item.releaseCaseId}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: priorityColor(item.priority),
                    }}
                  >
                    {item.priority}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      color: 'var(--shell-fg-3)',
                      textTransform: 'uppercase',
                    }}
                  >
                    {item.status.replace(/-/g, ' ')}
                  </span>
                </div>
              </button>
            ))}
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--shell-fg-3)' }}>
            Showing 2 priority items (mock data). Open Quality Batch Release workspace to see full queue.
          </p>
        </section>
      )}

      {/* Operations section — shown when operations-plan-risk is navigable */}
      {hasOperationsPlanRisk && (
        <section style={{ marginTop: 32 }}>
          <h2
            style={{
              margin: '0 0 12px',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--shell-fg-3)',
            }}
          >
            Plan Risk — Operations
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 680 }}>
            {MOCK_PLAN_RISK_ITEMS.map(item => (
              <button
                key={item.planDate}
                type="button"
                onClick={() => navigateToOperationsPlanRisk(item.planDate, 'plan-overview')}
                style={{
                  padding: '12px 16px',
                  background: 'var(--shell-surface)',
                  border: '1px solid var(--shell-line)',
                  borderLeft: `3px solid ${riskStatusColor(item.riskStatus)}`,
                  borderRadius: 6,
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                }}
                aria-label={`Open plan risk for ${item.plantName} on ${item.planDate}`}
              >
                <div>
                  <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--shell-fg)' }}>
                    {item.plantName} — {item.planDate}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginTop: 2 }}>
                    {item.topRiskReason}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: riskStatusColor(item.riskStatus),
                    }}
                  >
                    {item.riskStatus.replace(/-/g, ' ')}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--shell-fg-3)' }}>
                    {item.openBlockers} blockers · {item.lateOrders} late
                  </span>
                </div>
              </button>
            ))}
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--shell-fg-3)' }}>
            Showing 2 plan days (mock data). Open Operations Plan Risk workspace for full shift view.
          </p>
        </section>
      )}

      {/* Environmental Monitoring section — shown when envmon-monitoring is navigable */}
      {hasEnvMon && (
        <section style={{ marginTop: 32 }}>
          <h2
            style={{
              margin: '0 0 12px',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--shell-fg-3)',
            }}
          >
            Active Alerts — Environmental Monitoring
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 680 }}>
            {MOCK_ENVMON_ALERTS.map(alert => (
              <button
                key={alert.alertId}
                type="button"
                onClick={() => navigateToEnvMon('alerts')}
                style={{
                  padding: '12px 16px',
                  background: 'var(--shell-surface)',
                  border: '1px solid var(--shell-line)',
                  borderLeft: `3px solid ${severityColor(alert.severity)}`,
                  borderRadius: 6,
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                }}
                aria-label={`Open environmental alert ${alert.alertId} in ${alert.plantName}`}
              >
                <div>
                  <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--shell-fg)' }}>
                    {alert.organism}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginTop: 2 }}>
                    {alert.zoneId} · {alert.plantName} · {alert.description}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: severityColor(alert.severity),
                    }}
                  >
                    {alert.severity}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--shell-fg-3)', textTransform: 'uppercase' }}>
                    {alert.status.replace(/-/g, ' ')}
                  </span>
                </div>
              </button>
            ))}
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--shell-fg-3)' }}>
            Showing 2 active alerts (mock data). Open Environmental Monitoring workspace for full zone view.
          </p>
        </section>
      )}

      {/* Production Staging section — shown when production-staging is navigable */}
      {hasProductionStaging && (
        <section style={{ marginTop: 32 }}>
          <h2
            style={{
              margin: '0 0 12px',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--shell-fg-3)',
            }}
          >
            Staging Readiness — Production
          </h2>
          <button
            type="button"
            onClick={() => navigateToProductionStaging(MOCK_STAGING_SUMMARY.planDate, 'staging-overview')}
            style={{
              padding: '16px',
              background: 'var(--shell-surface)',
              border: '1px solid var(--shell-line)',
              borderLeft: `3px solid ${riskStatusColor(MOCK_STAGING_SUMMARY.riskStatus)}`,
              borderRadius: 6,
              cursor: 'pointer',
              textAlign: 'left',
              maxWidth: 680,
              width: '100%',
            }}
            aria-label={`Open production staging for ${MOCK_STAGING_SUMMARY.warehouseName} on ${MOCK_STAGING_SUMMARY.planDate}`}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--shell-fg)' }}>
                  {MOCK_STAGING_SUMMARY.warehouseName} — {MOCK_STAGING_SUMMARY.planDate}
                </div>
                <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginTop: 4, display: 'flex', gap: 12 }}>
                  <span>{Math.round(MOCK_STAGING_SUMMARY.percentReady)}% orders ready</span>
                  <span>{MOCK_STAGING_SUMMARY.openShortfalls} open shortfalls</span>
                  <span>{MOCK_STAGING_SUMMARY.pendingPickTasks} pending pick tasks</span>
                  <span>{MOCK_STAGING_SUMMARY.openMoveRequests} move requests</span>
                </div>
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: riskStatusColor(MOCK_STAGING_SUMMARY.riskStatus),
                  flexShrink: 0,
                  paddingTop: 2,
                }}
              >
                {MOCK_STAGING_SUMMARY.riskStatus.replace(/-/g, ' ')}
              </span>
            </div>
          </button>
          <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--shell-fg-3)' }}>
            Showing today&apos;s staging status (mock data). Open Production Staging workspace for order detail.
          </p>
        </section>
      )}
    </div>
  )
}
