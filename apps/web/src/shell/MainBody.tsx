import { Suspense, lazy } from 'react'
import { useWorkspaceShellState } from './useWorkspaceShellState.js'
import { workspaceRegistry } from '../registry/workspace-registry.js'
import { RoleAwareHome } from '../pages/RoleAwareHome.js'
import { NotFound } from '../pages/NotFound.js'
import { AdminGovernancePage } from '../pages/AdminGovernancePage.js'
import { LegacyRetirementPage } from '../pages/LegacyRetirementPage.js'
import { ProductionReadinessPage } from '../pages/ProductionReadinessPage.js'
import { WorkspaceParityPage } from '../pages/WorkspaceParityPage.js'
import { CutoverSimulationPage } from '../pages/CutoverSimulationPage.js'
import { RoleScopeMatrixPage } from '../pages/RoleScopeMatrixPage.js'
import { DesignSystemCompliancePage } from '../pages/DesignSystemCompliancePage.js'
import { TelemetryDashboardPage } from '../pages/TelemetryDashboardPage.js'

/**
 * Lazily loaded workspace view renderer.
 *
 * Split into its own chunk so the home screen loads without pulling in
 * workspace-specific code on first paint.
 */
const WorkspaceViews = lazy(() => import('../pages/WorkspaceViews.js'))

/** Renders the active page based on the current workspaceId. */
function ActivePage({ workspaceId }: { readonly workspaceId: string | null }) {
  if (!workspaceId) return <div className="connectio-page"><RoleAwareHome /></div>

  if (workspaceId === 'admin-governance') return <div className="connectio-page" data-testid="workspace-view-admin-governance"><AdminGovernancePage /></div>
  if (workspaceId === 'admin-legacy-retirement') return <div className="connectio-page" data-testid="workspace-view-admin-legacy-retirement"><LegacyRetirementPage /></div>
  if (workspaceId === 'admin-production-readiness') return <div className="connectio-page" data-testid="workspace-view-admin-production-readiness"><ProductionReadinessPage /></div>
  if (workspaceId === 'admin-workspace-parity') return <div className="connectio-page" data-testid="workspace-view-admin-workspace-parity"><WorkspaceParityPage /></div>
  if (workspaceId === 'admin-cutover-simulation') return <div className="connectio-page" data-testid="workspace-view-admin-cutover-simulation"><CutoverSimulationPage /></div>
  if (workspaceId === 'admin-role-scope-matrix') return <div className="connectio-page" data-testid="workspace-view-admin-role-scope-matrix"><RoleScopeMatrixPage /></div>
  if (workspaceId === 'admin-design-system-compliance') return <div className="connectio-page" data-testid="workspace-view-admin-design-system-compliance"><DesignSystemCompliancePage /></div>
  if (workspaceId === 'admin-telemetry') return <div className="connectio-page" data-testid="workspace-view-admin-telemetry"><TelemetryDashboardPage /></div>

  const found = workspaceRegistry.find(w => w.workspaceId === workspaceId)
  if (!found) return <div className="connectio-page"><NotFound /></div>

  return (
    <Suspense fallback={<div style={{ padding: 24, color: 'var(--shell-fg-2)' }}>Loading…</div>}>
      <WorkspaceViews workspaceId={workspaceId} />
    </Suspense>
  )
}

/**
 * Main scrollable body region of the shell.
 *
 * Routing logic (no router library):
 * - No `workspaceId` in URL → render {@link RoleAwareHome}
 * - Admin workspaceId strings → render dedicated admin page (no registry entry needed)
 * - `workspaceId` not found in registry → render {@link NotFound}
 * - Valid `workspaceId` → lazy-render {@link WorkspaceViews} with Suspense
 *
 * The `<main>` element provides the ARIA landmark for skip-to-content navigation.
 */
export function MainBody() {
  const { workspaceId } = useWorkspaceShellState()

  return (
    <main id="connectio-main-content" className="connectio-body">
      <ActivePage workspaceId={workspaceId} />
    </main>
  )
}
