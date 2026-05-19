import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { QualityResultsPanel } from './quality-results-panel.js'
import type { QualityReleaseAdapterRequest } from '../adapters/quality-release-adapter.js'
import { useQualityResults } from '../adapters/quality-release-queries.js'

// Mock the query hook to control the returned data state
vi.mock('../adapters/quality-release-queries.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../adapters/quality-release-queries.js')>()
  return {
    ...actual,
    useQualityResults: vi.fn(),
  }
})

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
    },
  })
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={makeQueryClient()}>
      {children}
    </QueryClientProvider>
  )
}

const request: QualityReleaseAdapterRequest = {
  releaseCaseId: 'RC-2024-001847',
  batchId: 'CH-240308-0047',
  plantId: 'IE10',
}

describe('QualityResultsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders "Inspection lot not found" when inspectionLotId is missing', async () => {
    vi.mocked(useQualityResults).mockReturnValue({
      data: {
        ok: true,
        fetchedAt: new Date().toISOString(),
        source: 'mock',
        data: {
          overallStatus: 'unknown',
          inspectionLotId: null, // missing lot ID
          inspectionCompletedAt: null,
          inspectionCompletedBy: null,
          micStatus: 'not-applicable',
          chemicalStatus: 'not-applicable',
          physicalStatus: 'not-applicable',
          sensoryStatus: 'not-applicable',
          micFailures: [],
        },
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useQualityResults>)

    render(
      <Wrapper>
        <QualityResultsPanel request={request} />
      </Wrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Inspection lot not found. No quality results available in SAP QM.')).toBeInTheDocument()
    })
  })

  it('renders "MIC Status is FAIL but no failure details were returned" on inconsistent state', async () => {
    vi.mocked(useQualityResults).mockReturnValue({
      data: {
        ok: true,
        fetchedAt: new Date().toISOString(),
        source: 'mock',
        data: {
          overallStatus: 'fail',
          inspectionLotId: 'LOT-12345',
          inspectionCompletedAt: null,
          inspectionCompletedBy: null,
          micStatus: 'fail', // FAIL status
          chemicalStatus: 'pass',
          physicalStatus: 'pass',
          sensoryStatus: 'pass',
          micFailures: [], // but empty failure details!
        },
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useQualityResults>)

    render(
      <Wrapper>
        <QualityResultsPanel request={request} />
      </Wrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('MIC Status is FAIL but no failure details were returned. Verify lot records in SAP QM.')).toBeInTheDocument()
    })
  })

  it('renders results lists and simulated mock disclaimer footnote', async () => {
    vi.mocked(useQualityResults).mockReturnValue({
      data: {
        ok: true,
        fetchedAt: new Date().toISOString(),
        source: 'mock',
        data: {
          overallStatus: 'pass',
          inspectionLotId: 'LOT-12345',
          inspectionCompletedAt: '2026-05-19T08:00:00Z',
          inspectionCompletedBy: 'Lab Analyst',
          micStatus: 'pass',
          chemicalStatus: 'pass',
          physicalStatus: 'pass',
          sensoryStatus: 'pass',
          micFailures: [],
        },
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useQualityResults>)

    render(
      <Wrapper>
        <QualityResultsPanel request={request} />
      </Wrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Inspection Lot:')).toBeInTheDocument()
      expect(screen.getByText('LOT-12345')).toBeInTheDocument()
      expect(screen.getByText(/This panel uses simulated mock data/i)).toBeInTheDocument()
    })
  })
})
