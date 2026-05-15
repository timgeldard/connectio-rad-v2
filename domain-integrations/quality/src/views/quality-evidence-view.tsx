import { QualityResultsPanel } from '../panels/quality-results-panel.js'
import { CoAReadinessPanel } from '../panels/coa-readiness-panel.js'
import { CoAReleaseStatusPanel, RiskSignalsPanel } from '@connectio/di-traceability'
import type { QualityReleaseAdapterRequest } from '../adapters/quality-release-adapter.js'
import type { Trace2AdapterRequest } from '@connectio/di-traceability'

/** Props for QualityEvidenceView. */
export interface QualityEvidenceViewProps {
  /** Adapter request context for own-domain quality panels. */
  readonly qualityRequest: QualityReleaseAdapterRequest
  /** Adapter request context for cross-domain traceability panels. */
  readonly traceRequest: Trace2AdapterRequest
}

/**
 * Quality Evidence view for the Quality Batch Release workspace.
 *
 * @remarks
 * Combines own-domain quality evidence (inspection results and CoA readiness)
 * with cross-domain traceability signals (CoA release status and risk signals)
 * sourced from the `@connectio/di-traceability` package. The four panels give
 * a complete analytical picture of quality disposition without leaving the
 * release workspace.
 */
export function QualityEvidenceView({ qualityRequest, traceRequest }: QualityEvidenceViewProps) {
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
      <QualityResultsPanel request={qualityRequest} />
      <CoAReadinessPanel request={qualityRequest} />
      <CoAReleaseStatusPanel request={traceRequest} />
      <RiskSignalsPanel request={traceRequest} />
    </div>
  )
}
