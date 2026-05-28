import type { EvidencePanelRegistration } from '@connectio/product-model'

/** Props for EvidencePanelHeader. */
export interface EvidencePanelHeaderProps {
  registration: EvidencePanelRegistration
  /** Accepted but no longer rendered — kept for call-site compatibility. */
  source?: string
}

export function EvidencePanelHeader({ registration }: EvidencePanelHeaderProps) {
  const { displayName } = registration

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-2)',
        padding: '10px 14px',
        borderBottom: '1px solid var(--shell-line)',
        background: 'var(--shell-surface)',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontSize: 'var(--fs-14)',
          fontWeight: 'var(--fw-semibold)',
          color: 'var(--shell-fg)',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {displayName}
      </span>
    </div>
  )
}
