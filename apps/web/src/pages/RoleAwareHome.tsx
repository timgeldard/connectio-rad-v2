import { usePinnedWorkspaces } from '@connectio/personalization'
import { isNavigable } from '@connectio/product-model'
import { workspaceRegistry } from '../registry/workspace-registry.js'
import { useWorkspaceShellState } from '../shell/useWorkspaceShellState.js'

/**
 * Home screen rendered when no workspace is active in the URL.
 *
 * Displays the user's pinned, navigable workspaces as clickable cards. When
 * `pinnedWorkspaces` is null (not yet loaded or no pins set) the full set of
 * navigable workspaces is shown instead, providing a sensible fallback.
 */
export function RoleAwareHome() {
  const { setWorkspace } = useWorkspaceShellState()
  const [pinnedWorkspaces] = usePinnedWorkspaces(workspaceRegistry.map(w => w.workspaceId))

  const pinned = workspaceRegistry.filter(
    w =>
      isNavigable(w.lifecycle) &&
      (pinnedWorkspaces === null || pinnedWorkspaces.includes(w.workspaceId)),
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
    </div>
  )
}
