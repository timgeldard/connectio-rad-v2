import { EvidenceStatusBadge, type EvidenceStatus } from '@connectio/design-system'
import type { AdapterSource } from '@connectio/source-adapters'

interface EvidenceSection {
  readonly id: string
  readonly name: string
  readonly status: EvidenceStatus
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
          {sections.filter(s => ['ready', 'loaded', 'mock-only'].includes(s.status)).length} / {sections.length} Loaded
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
               {section.source && (
                 <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--shell-fg-3)', textTransform: 'uppercase', opacity: 0.7 }}>
                   {section.source}
                 </span>
               )}
               <EvidenceStatusBadge status={section.status} />
            </div>
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
