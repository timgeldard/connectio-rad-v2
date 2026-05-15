import {
  OwnerBadge,
  LifecycleBadge,
} from '@connectio/design-system'
import { requiresLifecycleBadge } from '@connectio/product-model'
import type { LifecycleBadgeVariant } from '@connectio/design-system'
import type { EvidencePanelRegistration } from '@connectio/product-model'

/** Props for EvidencePanelHeader. */
export interface EvidencePanelHeaderProps {
  /** Panel registration record providing displayName, ownerDomain, and lifecycle. */
  registration: EvidencePanelRegistration
}

/**
 * EvidencePanelHeader renders the panel title row.
 *
 * @remarks
 * Displays the panel's display name as a heading, an OwnerBadge identifying the
 * owning domain, and a LifecycleBadge when the panel's lifecycle requires one
 * (pilot, concept-lab, or deprecated). Live panels do not show a lifecycle badge.
 */
export function EvidencePanelHeader({ registration }: EvidencePanelHeaderProps) {
  const { displayName, ownerDomain, lifecycle } = registration

  // requiresLifecycleBadge returns true only for pilot | concept-lab | deprecated,
  // which are exactly the variants LifecycleBadge accepts.
  const showLifecycleBadge = requiresLifecycleBadge(lifecycle)

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
      {showLifecycleBadge && (
        <LifecycleBadge variant={lifecycle as LifecycleBadgeVariant} />
      )}
      <OwnerBadge domainId={ownerDomain} displayName={ownerDomain} />
    </div>
  )
}
