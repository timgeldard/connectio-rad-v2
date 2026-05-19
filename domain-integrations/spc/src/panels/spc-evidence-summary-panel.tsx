import type { AdapterSource } from '@connectio/source-adapters'

interface EvidenceSection {
  readonly id: string
  readonly name: string
  readonly status: 'loading' | 'ready' | 'error' | 'pending-uat'
  readonly source?: AdapterSource
  readonly count?: number
  readonly message?: string
}

interface SPCEvidenceSummaryPanelProps {
  readonly sections: EvidenceSection[]
}

export function SPCEvidenceSummaryPanel({ sections }: SPCEvidenceSummaryPanelProps) {
  return (
    <div
      style={{
        padding: '16px',
        background: 'var(--shell-surface)',
        border: '1px solid var(--shell-line)',
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--shell-fg)' }}>
          SPC Evidence Completeness Summary
        </h3>
        <div style={{ fontSize: '11px', color: 'var(--shell-fg-3)', fontWeight: 500 }}>
          {sections.filter(s => s.status === 'ready').length} / {sections.length} Ready
        </div>
      </div>

      <div style={{ display: 'grid', gap: '8px' }}>
        {sections.map(section => (
          <div
            key={section.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto auto',
              alignItems: 'center',
              gap: '12px',
              padding: '8px 12px',
              background: 'var(--shell-surface-2)',
              borderRadius: '6px',
              border: '1px solid var(--shell-line)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--shell-fg)' }}>
                {section.name}
              </span>
              {section.message && (
                <span style={{ fontSize: '10px', color: 'var(--shell-fg-3)' }}>
                  {section.message}
                </span>
              )}
            </div>

            {section.count !== undefined && (
              <div style={{ 
                fontSize: '11px', 
                fontWeight: 700, 
                color: 'var(--shell-fg-2)',
                background: 'var(--shell-surface)',
                padding: '2px 6px',
                borderRadius: '4px',
                minWidth: '24px',
                textAlign: 'center'
              }}>
                {section.count}
              </div>
            )}

            <StatusBadge status={section.status} source={section.source} />
          </div>
        ))}
      </div>

      <div style={{ 
        marginTop: '4px',
        padding: '8px 12px',
        background: 'rgba(56, 139, 253, 0.05)',
        border: '1px solid rgba(56, 139, 253, 0.2)',
        borderRadius: '6px',
        fontSize: '11px',
        color: 'var(--shell-fg-2)',
        lineHeight: 1.5
      }}>
        <strong style={{ color: 'var(--shell-accent, #388BFD)' }}>Read-Only UAT Notice:</strong> This summary tracks the availability of evidence panels within the current scope. 'Mock' status indicates high-fidelity simulation for workflow validation.
      </div>
    </div>
  )
}

function StatusBadge({ status, source }: { status: EvidenceSection['status']; source?: AdapterSource }) {
  const styles: Record<EvidenceSection['status'], { bg: string; color: string; border: string }> = {
    loading: { bg: 'var(--shell-surface-2)', color: 'var(--shell-fg-3)', border: 'var(--shell-line)' },
    ready: { bg: 'rgba(31, 139, 76, 0.1)', color: 'var(--shell-good, #1F8B4C)', border: 'rgba(31, 139, 76, 0.2)' },
    error: { bg: 'rgba(199, 51, 21, 0.1)', color: 'var(--shell-bad, #C73315)', border: 'rgba(199, 51, 21, 0.2)' },
    'pending-uat': { bg: 'rgba(199, 130, 28, 0.1)', color: 'var(--shell-warn, #C7821C)', border: 'rgba(199, 130, 28, 0.2)' },
  }

  const style = styles[status]

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      {source && (
        <span style={{ 
          fontSize: '9px', 
          fontWeight: 700, 
          textTransform: 'uppercase',
          color: 'var(--shell-fg-3)',
          opacity: 0.7
        }}>
          {source}
        </span>
      )}
      <div
        style={{
          padding: '2px 8px',
          borderRadius: '12px',
          background: style.bg,
          color: style.color,
          border: `1px solid ${style.border}`,
          fontSize: '10px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.02em',
        }}
      >
        {status.replace(/-/g, ' ')}
      </div>
    </div>
  )
}
