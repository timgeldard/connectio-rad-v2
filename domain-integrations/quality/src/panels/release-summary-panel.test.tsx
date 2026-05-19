import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReleaseSummaryPanel } from './release-summary-panel.js'
import type { QualityReleaseAdapterRequest } from '../adapters/quality-release-adapter.js'

/**
 * Creates a QueryClient configured for testing (no retries, instant stale time).
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
    },
  })
}

/**
 * Wraps children in QueryClientProvider for hook-based components.
 */
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

describe('ReleaseSummaryPanel', () => {
  it('renders the panel container with correct data-testid', async () => {
    render(
      <Wrapper>
        <ReleaseSummaryPanel request={request} />
      </Wrapper>
    )

    // The EvidencePanel wrapper renders data-testid="evidence-panel-batch-release-summary"
    await waitFor(() => {
      const panel = document.querySelector('[data-testid="evidence-panel-batch-release-summary"]')
      expect(panel).not.toBeNull()
    })
  })

  it('renders the panel title', async () => {
    render(
      <Wrapper>
        <ReleaseSummaryPanel request={request} />
      </Wrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Release Summary')).toBeInTheDocument()
    })
  })

  it('renders readiness status after data loads', async () => {
    render(
      <Wrapper>
        <ReleaseSummaryPanel request={request} />
      </Wrapper>
    )

    // Mock data has overallReadiness: 'blocked'
    await waitFor(() => {
      const blocked = screen.queryByText(/blocked/i)
      expect(blocked).not.toBeNull()
    })
  })

  it('renders recommended action', async () => {
    render(
      <Wrapper>
        <ReleaseSummaryPanel request={request} />
      </Wrapper>
    )

    // Mock data has recommendedAction: 'reject'
    await waitFor(() => {
      const action = screen.queryByText(/reject/i)
      expect(action).not.toBeNull()
    })
  })

  it('renders advisory and note footnotes explaining QI stock restrictions and system recommendations', async () => {
    render(
      <Wrapper>
        <ReleaseSummaryPanel request={request} />
      </Wrapper>
    )

    await waitFor(() => {
      expect(screen.getByText(/Quality Inspection \(QI\) stock is physically restricted/i)).toBeInTheDocument()
      expect(screen.getByText(/Recommended actions are system-generated/i)).toBeInTheDocument()
    })
  })

  it('does not render live source badges when source is mock', async () => {
    render(
      <Wrapper>
        <ReleaseSummaryPanel request={request} />
      </Wrapper>
    )

    await waitFor(() => {
      expect(screen.queryByText('Legacy API')).toBeNull()
      expect(screen.queryByText('Databricks')).toBeNull()
    })
  })
})
