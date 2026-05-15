import { TraceInvestigationWorkspace } from '@connectio/di-traceability'
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
 * Phase 1 implements `trace-investigation` fully. All other workspace IDs
 * render a placeholder until their domain integration is implemented in
 * a subsequent phase.
 *
 * The `scope` from `useAuthScope()` and the `investigationId`/`viewId` URL
 * params are forwarded to workspace components that require them.
 *
 * @param props - Component props.
 */
export default function WorkspaceViews({ workspaceId }: Props) {
  const { investigationId, viewId } = useWorkspaceShellState()
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

  return (
    <div className="connectio-page" data-testid={`workspace-view-${workspaceId}`}>
      <div style={{ padding: 32, color: 'var(--shell-fg-2)', fontSize: 13 }}>
        Workspace{' '}
        <strong style={{ color: 'var(--shell-fg)' }}>{workspaceId}</strong> —
        implementation pending (Phase 2+).
      </div>
    </div>
  )
}
