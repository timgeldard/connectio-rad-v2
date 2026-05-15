import { usePinnedWorkspaces } from '@connectio/personalization'
import { isNavigable } from '@connectio/product-model'
import { workspaceRegistry } from '../registry/workspace-registry.js'
import { useWorkspaceShellState } from '../shell/useWorkspaceShellState.js'

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
  const { setWorkspace, navigateToBatchRelease } = useWorkspaceShellState()
  const [pinnedWorkspaces] = usePinnedWorkspaces(workspaceRegistry.map(w => w.workspaceId))

  const pinned = workspaceRegistry.filter(
    w =>
      isNavigable(w.lifecycle) &&
      (pinnedWorkspaces === null || pinnedWorkspaces.includes(w.workspaceId)),
  )

  const hasBatchRelease = workspaceRegistry.some(
    w => w.workspaceId === 'quality-batch-release' && isNavigable(w.lifecycle),
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
    </div>
  )
}
