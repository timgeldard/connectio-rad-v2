import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OrderConfirmationsPanel } from './order-confirmations-panel.js'
import type { ProcessOrderReviewAdapterRequest } from '../adapters/process-order-review-adapter.js'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  })
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={makeQueryClient()}>
      {children}
    </QueryClientProvider>
  )
}

const request: ProcessOrderReviewAdapterRequest = {
  processOrderId: 'PO-240308-3847',
  plantId: 'IE10',
}

describe('OrderConfirmationsPanel', () => {
  it('renders the panel container', async () => {
    render(
      <Wrapper>
        <OrderConfirmationsPanel request={request} />
      </Wrapper>
    )
    await waitFor(() => {
      const panel = document.querySelector('[data-testid="evidence-panel-order-confirmations"]')
      expect(panel).not.toBeNull()
    })
  })

  it('renders the panel title', async () => {
    render(
      <Wrapper>
        <OrderConfirmationsPanel request={request} />
      </Wrapper>
    )
    await waitFor(() => {
      expect(screen.getByText('Confirmations')).toBeInTheDocument()
    })
  })

  it('shows open confirmations banner for 2 open confirmations', async () => {
    render(
      <Wrapper>
        <OrderConfirmationsPanel request={request} />
      </Wrapper>
    )
    await waitFor(() => {
      expect(screen.getByText(/2 open confirmations/)).toBeInTheDocument()
    })
  })

  it('renders Milk Standardisation confirmation', async () => {
    render(
      <Wrapper>
        <OrderConfirmationsPanel request={request} />
      </Wrapper>
    )
    await waitFor(() => {
      expect(screen.getByText(/Milk Standardisation/)).toBeInTheDocument()
    })
  })

  it('shows scrap quantity for OP-050 Cutting and Drainage', async () => {
    render(
      <Wrapper>
        <OrderConfirmationsPanel request={request} />
      </Wrapper>
    )
    await waitFor(() => {
      const scrapElements = screen.getAllByText(/scrap:/)
      expect(scrapElements.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('renders variance percentage', async () => {
    render(
      <Wrapper>
        <OrderConfirmationsPanel request={request} />
      </Wrapper>
    )
    await waitFor(() => {
      const varianceElements = screen.getAllByText(/vs plan/)
      expect(varianceElements.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('renders final badge for CONF-001', async () => {
    render(
      <Wrapper>
        <OrderConfirmationsPanel request={request} />
      </Wrapper>
    )
    await waitFor(() => {
      const finalBadges = screen.getAllByText('final')
      expect(finalBadges.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('renders partial badge for open confirmations', async () => {
    render(
      <Wrapper>
        <OrderConfirmationsPanel request={request} />
      </Wrapper>
    )
    await waitFor(() => {
      const partialBadges = screen.getAllByText('partial')
      expect(partialBadges.length).toBe(2)
    })
  })
})
