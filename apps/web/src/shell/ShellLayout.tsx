import { DomainSidebar } from './DomainSidebar.js'
import { GlobalHeader } from './GlobalHeader.js'
import { ScopeBar } from './ScopeBar.js'
import { MainBody } from './MainBody.js'
import { useWorkspaceShellState } from './useWorkspaceShellState.js'

/**
 * Root CSS grid shell for the ConnectIO unified interface.
 *
 * Grid slots:
 * - `.connectio-rail`     — 56 px left nav rail (always visible)
 * - `.connectio-topbar`   — 48 px global header
 * - `.connectio-scopebar` — 40 px contextual scope bar (conditionally rendered)
 * - `.connectio-body`     — remaining viewport, scrollable content area
 *
 * The `.no-scope` modifier is applied to the root when no workspace is active,
 * allowing the grid to collapse the scopebar row via CSS.
 */
export function ShellLayout() {
  const { hasScope } = useWorkspaceShellState()

  return (
    <div
      className={`connectio-shell${hasScope ? '' : ' no-scope'}`}
      data-testid="workspace-shell"
    >
      <DomainSidebar />
      <GlobalHeader />
      {hasScope && <ScopeBar />}
      <MainBody />
    </div>
  )
}
