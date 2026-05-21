// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { QualityReadOnlyEvidencePanel } from './quality-readonly-evidence-panel.js'
import { useQualityReadOnlyEvidence } from '../adapters/quality-readonly-evidence-queries.js'
import type { QualityReadOnlyEvidenceAdapterRequest } from '../adapters/quality-readonly-evidence-adapter.js'

vi.mock('@connectio/evidence-panel-runtime', () => ({
  EvidencePanel: ({ children }: { children?: React.ReactNode }) => <div data-testid="evidence-panel">{children}</div>,
  useEvidencePanel: () => ({ displayState: 'ready', markReady: vi.fn(), markError: vi.fn() }),
}))

vi.mock('../adapters/quality-readonly-evidence-queries.js', () => ({
  useQualityReadOnlyEvidence: vi.fn(),
}))

const request: QualityReadOnlyEvidenceAdapterRequest = {
  plantId: 'C113',
  materialId: '000000000070373871',
  batchId: '0008602411',
}

describe('QualityReadOnlyEvidencePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useQualityReadOnlyEvidence).mockReturnValue({
      data: {
        ok: true,
        fetchedAt: '2026-05-21T09:15:00.000Z',
        source: 'databricks-api',
        data: {
          request,
          summary: {
            source: 'databricks-api',
            status: 'pending-source-verification',
            inspectionLotCount: 0,
            micResultCount: 0,
            usageDecisionStatus: 'source-unverified',
            coaResultCount: 0,
            unavailableEvidence: ['inspection-lots', 'mic-results', 'usage-decision', 'coa-results'],
            warnings: [
              'Read-only Quality evidence is pending Databricks source verification.',
              'Missing usage-decision evidence must not be interpreted as accepted or released.',
              'CoA-like result evidence is not official CoA document approval.',
            ],
            queriedAt: '2026-05-21T09:15:00.000Z',
            sourceFreshnessStatus: 'not-verified',
          },
          inspectionLots: [],
          micResults: [],
          usageDecision: null,
          coaResults: [],
        },
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useQualityReadOnlyEvidence>)
  })

  it('renders pending source verification warning copy', () => {
    render(<QualityReadOnlyEvidencePanel request={request} />)

    expect(screen.getByText(/Read-only Quality evidence is not yet source-verified in V2/i)).toBeInTheDocument()
    expect(screen.getByText(/Missing usage-decision, CoA, or deviation evidence must not be interpreted/i)).toBeInTheDocument()
  })

  it('renders unavailable section states without release approval language', () => {
    render(<QualityReadOnlyEvidencePanel request={request} />)

    expect(screen.getByText(/Inspection lot evidence/i)).toBeInTheDocument()
    expect(screen.getByText(/MIC \/ inspection characteristic evidence/i)).toBeInTheDocument()
    expect(screen.getByText(/Usage decision evidence/i)).toBeInTheDocument()
    expect(screen.getAllByText(/CoA-like result evidence/i).length).toBeGreaterThan(0)
    expect(screen.queryByText(/release ready/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/approved/i)).not.toBeInTheDocument()
  })

  it('keeps Quality and SPC concepts separated', () => {
    render(<QualityReadOnlyEvidencePanel request={request} />)

    expect(screen.getByText('Specification limits are not SPC control limits.')).toBeInTheDocument()
    expect(screen.getByText('MIC result valuation is not a release decision.')).toBeInTheDocument()
  })
})
