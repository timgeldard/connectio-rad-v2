import { Suspense, lazy } from 'react'
import { useWorkspaceShellState } from './useWorkspaceShellState.js'
import { workspaceRegistry } from '../registry/workspace-registry.js'
import { RoleAwareHome } from '../pages/RoleAwareHome.js'
import { NotFound } from '../pages/NotFound.js'

/**
 * Lazily loaded workspace view renderer.
 *
 * Split into its own chunk so the home screen loads without pulling in
 * workspace-specific code on first paint.
 */
const WorkspaceViews = lazy(() => import('../pages/WorkspaceViews.js'))

/**
 * Main scrollable body region of the shell.
 *
 * Routing logic (no router library):
 * - No `workspaceId` in URL → render {@link RoleAwareHome}
 * - `workspaceId` not found in registry → render {@link NotFound}
 * - Valid `workspaceId` → lazy-render {@link WorkspaceViews} with Suspense
 */
export function MainBody() {
  const { workspaceId } = useWorkspaceShellState()

  if (!workspaceId) {
    return (
      <div className="connectio-body">
        <div className="connectio-page">
          <RoleAwareHome />
        </div>
      </div>
    )
  }

  const found = workspaceRegistry.find(w => w.workspaceId === workspaceId)
  if (!found) {
    return (
      <div className="connectio-body">
        <div className="connectio-page">
          <NotFound />
        </div>
      </div>
    )
  }

  return (
    <div className="connectio-body">
      <Suspense
        fallback={
          <div style={{ padding: 24, color: 'var(--shell-fg-2)' }}>Loading…</div>
        }
      >
        <WorkspaceViews workspaceId={workspaceId} />
      </Suspense>
    </div>
  )
}
