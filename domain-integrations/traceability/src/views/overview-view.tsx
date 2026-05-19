import { useState } from 'react'
import { BatchHeaderPanel } from '../panels/batch-header-panel.js'
import { RiskSignalsPanel } from '../panels/risk-signals-panel.js'
import { TraceGraphPanel } from '../panels/trace-graph-panel.js'
import { CustomerImpactPanel } from '../panels/customer-impact-panel.js'
import { CoAReleaseStatusPanel } from '../panels/coa-release-status-panel.js'
import { EventTimelinePanel } from '../panels/event-timeline-panel.js'
import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'
import {
  useBatchHeaderSummary,
  useCustomerExposureSummary,
  useMassBalanceSummary,
  useCoAReleaseStatus,
  useSupplierExposureSummary,
  useTraceGraph,
} from '../adapters/trace2-queries.js'
import { calculateConfidence } from '../components/EvidenceConfidence.js'
import { InvestigationSummary } from '../components/InvestigationSummary.js'
import { EvidencePackReadiness } from '../components/EvidencePackReadiness.js'

/** Props for OverviewView. */
export interface OverviewViewProps {
  /** Adapter request context forwarded to all panels. */
  readonly request: Trace2AdapterRequest
}

/**
 * Overview view for the Trace Investigation workspace.
 *
 * @remarks
 * Renders the consolidated InvestigationSummary at the top of the layout,
 * and a split grid containing the 6 modular evidence panels alongside the
 * EvidencePackReadiness digital compilation checklist.
 */
export function OverviewView({ request }: OverviewViewProps) {
  const [sim, setSim] = useState(false)

  // Fetch all required data sectors for confidence rating and cockpit header
  const { data: batchHeaderResult } = useBatchHeaderSummary(request)
  const { data: customerExposureResult } = useCustomerExposureSummary(request)
  const { data: massBalanceResult } = useMassBalanceSummary(request)
  const { data: coaReleaseResult } = useCoAReleaseStatus(request)
  const { data: supplierExposureResult } = useSupplierExposureSummary(request)
  const { data: traceGraphResult } = useTraceGraph(request)

  const batchHeader = batchHeaderResult?.ok ? batchHeaderResult.data : null
  const customerExposure = customerExposureResult?.ok ? customerExposureResult.data : null
  const massBalance = massBalanceResult?.ok ? massBalanceResult.data : null
  const coaRelease = coaReleaseResult?.ok ? coaReleaseResult.data : null
  const supplierExposure = supplierExposureResult?.ok ? supplierExposureResult.data : null
  const traceGraph = traceGraphResult?.ok ? traceGraphResult.data : null

  // Calculate evidence confidence dossier metrics
  const confidence = calculateConfidence({
    batchHeader,
    customerExposure,
    massBalance,
    coaRelease,
    supplierExposure,
    traceGraph,
  })

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: 16,
      }}
    >
      {/* Case Header / Investigation cockpit summary */}
      <InvestigationSummary
        batchHeader={batchHeader}
        customerExposure={customerExposure}
        supplierExposure={supplierExposure}
        confidence={confidence}
        sim={sim}
        onSim={setSim}
      />

      {/* Grid structure dividing modular panels and the digital signature card */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 3fr) minmax(280px, 1fr)',
          gap: 16,
          alignItems: 'start',
        }}
      >
        {/* Six modular evidence panels */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 12,
          }}
        >
          <BatchHeaderPanel request={request} />
          <RiskSignalsPanel request={request} />
          <TraceGraphPanel request={request} />
          <CustomerImpactPanel request={request} />
          <CoAReleaseStatusPanel request={request} />
          <EventTimelinePanel request={request} />
        </div>

        {/* Digital verification checklist panel */}
        <EvidencePackReadiness confidence={confidence} />
      </div>
    </div>
  )
}
