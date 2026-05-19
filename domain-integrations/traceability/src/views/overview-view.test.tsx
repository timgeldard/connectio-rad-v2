import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OverviewView } from './overview-view.js'
import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'

// Mock sub-components
vi.mock('../panels/batch-header-panel.js', () => ({
  BatchHeaderPanel: () => <div data-testid="mock-batch-header-panel" />,
}))
vi.mock('../panels/risk-signals-panel.js', () => ({
  RiskSignalsPanel: () => <div data-testid="mock-risk-signals-panel" />,
}))
vi.mock('../panels/trace-graph-panel.js', () => ({
  TraceGraphPanel: () => <div data-testid="mock-trace-graph-panel" />,
}))
vi.mock('../panels/customer-impact-panel.js', () => ({
  CustomerImpactPanel: () => <div data-testid="mock-customer-impact-panel" />,
}))
vi.mock('../panels/coa-release-status-panel.js', () => ({
  CoAReleaseStatusPanel: () => <div data-testid="mock-coa-release-status-panel" />,
}))
vi.mock('../panels/event-timeline-panel.js', () => ({
  EventTimelinePanel: () => <div data-testid="mock-event-timeline-panel" />,
}))

// Mock queries
vi.mock('../adapters/trace2-queries.js', () => ({
  useBatchHeaderSummary: () => ({ data: { ok: true, data: {} } }),
  useCustomerExposureSummary: () => ({ data: { ok: true, data: { countries: [] } } }),
  useMassBalanceSummary: () => ({ data: { ok: true, data: {} } }),
  useCoAReleaseStatus: () => ({ data: { ok: true, data: {} } }),
  useSupplierExposureSummary: () => ({ data: { ok: true, data: {} } }),
  useTraceGraph: () => ({ data: { ok: true, data: {} } }),
}))

const mockRequest: Trace2AdapterRequest = {
  investigationId: 'test-inv',
  batchId: 'test-batch',
}

describe('OverviewView', () => {
  it('renders all six modular panels correctly', () => {
    render(<OverviewView request={mockRequest} />)

    expect(screen.getByTestId('mock-batch-header-panel')).not.toBeNull()
    expect(screen.getByTestId('mock-risk-signals-panel')).not.toBeNull()
    expect(screen.getByTestId('mock-trace-graph-panel')).not.toBeNull()
    expect(screen.getByTestId('mock-customer-impact-panel')).not.toBeNull()
    expect(screen.getByTestId('mock-coa-release-status-panel')).not.toBeNull()
    expect(screen.getByTestId('mock-event-timeline-panel')).not.toBeNull()
  })

  it('renders the investigation summary header and digital checklist panel', () => {
    render(<OverviewView request={mockRequest} />)

    expect(screen.getByText('Batch Investigation Cockpit')).not.toBeNull()
    expect(screen.getByText('Evidence Pack Readiness')).not.toBeNull()
  })
})
