import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CoAReadinessPanel } from './coa-readiness-panel.js'
import type { QualityReleaseAdapterRequest } from '../adapters/quality-release-adapter.js'
import { useCoAReadiness } from '../adapters/quality-release-queries.js'

// Mock the query hook to control the returned data state
vi.mock('../adapters/quality-release-queries.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../adapters/quality-release-queries.js')>()
  return {
    ...actual,
    useCoAReadiness: vi.fn(),
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

describe('CoAReadinessPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders "CoA document unavailable" when coaDocumentId is missing', async () => {
    vi.mocked(useCoAReadiness).mockReturnValue({
      data: {
        ok: true,
        fetchedAt: new Date().toISOString(),
        source: 'mock',
        data: {
          readinessStatus: 'incomplete',
          coaDocumentId: null, // missing ID
          signedOffBy: null,
          signedOffAt: null,
          missingFields: ['pH result'],
          customerSpecificCoas: [],
        },
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useCoAReadiness>)

    render(
      <Wrapper>
        <CoAReadinessPanel request={request} />
      </Wrapper>
    )

    await waitFor(() => {
      expect(screen.queryByText('CoA document unavailable')).not.toBeNull()
      expect(screen.queryByText(/^incomplete$/i)).not.toBeNull()
    })
  })

  it('renders document ID and signed-off details when present', async () => {
    vi.mocked(useCoAReadiness).mockReturnValue({
      data: {
        ok: true,
        fetchedAt: new Date().toISOString(),
        source: 'mock',
        data: {
          readinessStatus: 'complete',
          coaDocumentId: 'COA-998877',
          signedOffBy: 'Jane Manager',
          signedOffAt: '2026-05-19T10:00:00Z',
          missingFields: [],
          customerSpecificCoas: [],
        },
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useCoAReadiness>)

    render(
      <Wrapper>
        <CoAReadinessPanel request={request} />
      </Wrapper>
    )

    expect(screen.queryByText(/COA-998877/)).not.toBeNull()
    expect(screen.queryByText(/Jane Manager/)).not.toBeNull()
    expect(screen.queryByText(/^complete$/i)).not.toBeNull()
  })

  it('renders simulated mock disclaimer footnote', async () => {
    vi.mocked(useCoAReadiness).mockReturnValue({
      data: {
        ok: true,
        fetchedAt: new Date().toISOString(),
        source: 'mock',
        data: {
          readinessStatus: 'not-applicable',
          coaDocumentId: null,
          signedOffBy: null,
          signedOffAt: null,
          missingFields: [],
          customerSpecificCoas: [],
        },
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useCoAReadiness>)

    render(
      <Wrapper>
        <CoAReadinessPanel request={request} />
      </Wrapper>
    )

    await waitFor(() => {
      expect(screen.queryByText(/This panel uses simulated mock data/i)).not.toBeNull()
    })
  })
})
