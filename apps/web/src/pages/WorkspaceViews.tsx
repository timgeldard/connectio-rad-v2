/** Props for the workspace view renderer. */
interface Props {
  /** The id of the workspace to render, matched against the registry. */
  readonly workspaceId: string
}

/**
 * Workspace content renderer (Phase 0 stub).
 *
 * This module is loaded lazily via `React.lazy` in {@link MainBody}.
 * Domain-integration packages will replace the placeholder content in Phase 1
 * by registering their own view components against `workspaceId`.
 *
 * @param props - Component props.
 * @returns Placeholder content indicating the workspace is pending implementation.
 */
export default function WorkspaceViews({ workspaceId }: Props) {
  return (
    <div className="connectio-page" data-testid={`workspace-view-${workspaceId}`}>
      <div style={{ padding: 32, color: 'var(--shell-fg-2)', fontSize: 13 }}>
        Workspace{' '}
        <strong style={{ color: 'var(--shell-fg)' }}>{workspaceId}</strong> —
        implementation pending (Phase 1).
      </div>
    </div>
  )
}
