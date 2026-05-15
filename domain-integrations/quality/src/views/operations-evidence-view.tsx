import { ProcessOrderEvidencePanel } from '@connectio/di-operations'
import { WarehouseHoldStatusPanel } from '@connectio/di-warehouse'
import { EventTimelinePanel } from '@connectio/di-traceability'
import { DeviationsPanel } from '../panels/deviations-panel.js'
import type { QualityReleaseAdapterRequest } from '../adapters/quality-release-adapter.js'
import type { OperationsEvidenceAdapterRequest } from '@connectio/di-operations'
import type { WarehouseEvidenceAdapterRequest } from '@connectio/di-warehouse'
import type { Trace2AdapterRequest } from '@connectio/di-traceability'

/** Props for OperationsEvidenceView. */
export interface OperationsEvidenceViewProps {
  /** Adapter request context for own-domain quality panels. */
  readonly qualityRequest: QualityReleaseAdapterRequest
  /** Adapter request context for cross-domain operations panels. */
  readonly operationsRequest: OperationsEvidenceAdapterRequest
  /** Adapter request context for cross-domain warehouse panels. */
  readonly warehouseRequest: WarehouseEvidenceAdapterRequest
  /** Adapter request context for cross-domain traceability panels. */
  readonly traceRequest: Trace2AdapterRequest
}

/**
 * Operations Evidence view for the Quality Batch Release workspace.
 *
 * @remarks
 * Draws together evidence from four domains — operations (process order
 * execution), warehouse (stock hold status), traceability (event timeline),
 * and quality (deviations) — so that the release decision maker can assess
 * manufacturing conformance without navigating away from the release workspace.
 * Each panel is independently data-fetching and displays its own loading and
 * error states.
 */
export function OperationsEvidenceView({
  qualityRequest,
  operationsRequest,
  warehouseRequest,
  traceRequest,
}: OperationsEvidenceViewProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 12,
        padding: 16,
        alignItems: 'start',
      }}
    >
      <ProcessOrderEvidencePanel request={operationsRequest} />
      <WarehouseHoldStatusPanel request={warehouseRequest} />
      <EventTimelinePanel request={traceRequest} />
      <DeviationsPanel request={qualityRequest} />
    </div>
  )
}
