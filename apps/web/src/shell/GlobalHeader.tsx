/**
 * Global top-bar header rendered across all views.
 *
 * Contains the application name and the Kerry brand identifier. Additional
 * controls (user menu, notifications) will be added in Phase 1.
 */
export function GlobalHeader() {
  return (
    <header className="connectio-topbar">
      <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--shell-fg)' }}>
        ConnectIO
      </span>
      <div className="connectio-topbar-right">
        <span style={{ fontSize: 12, color: 'var(--shell-fg-2)' }}>Kerry</span>
      </div>
    </header>
  )
}
