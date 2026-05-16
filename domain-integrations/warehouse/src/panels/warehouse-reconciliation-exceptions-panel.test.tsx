import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WarehouseReconciliationExceptionsPanel } from './warehouse-reconciliation-exceptions-panel.js'
import type { Warehouse360AdapterRequest } from '../adapters/warehouse-360-adapter.js'

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } })
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={makeQueryClient()}>{children}</QueryClientProvider>
}

const request: Warehouse360AdapterRequest = { warehouseId: 'WH-IE10-MAIN', plantId: 'IE10' }

describe('WarehouseReconciliationExceptionsPanel', () => {
  it('renders the panel container', async () => {
    render(<Wrapper><WarehouseReconciliationExceptionsPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="evidence-panel-warehouse-reconciliation-exceptions"]')).not.toBeNull()
    })
  })

  it('renders the panel display name', async () => {
    render(<Wrapper><WarehouseReconciliationExceptionsPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText('IM/WM Reconciliation Exceptions')).toBeInTheDocument()
    })
  })

  it('renders open exceptions count banner', async () => {
    render(<Wrapper><WarehouseReconciliationExceptionsPanel request={request} /></Wrapper>)
    // mock has 2 open exceptions (RECON-00047 and RECON-00044 are 'open'; RECON-00046 is 'in-progress')
    await waitFor(() => {
      expect(screen.getByText(/open exception/i)).toBeInTheDocument()
    })
  })

  it('renders quantity mismatch label', async () => {
    render(<Wrapper><WarehouseReconciliationExceptionsPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText(/Qty mismatch/i)).toBeInTheDocument()
    })
  })

  it('renders missing in WM label', async () => {
    render(<Wrapper><WarehouseReconciliationExceptionsPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText(/Missing in WM/i)).toBeInTheDocument()
    })
  })

  it('renders material description for emmental', async () => {
    render(<Wrapper><WarehouseReconciliationExceptionsPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText(/Emmental Block 4 kg/i)).toBeInTheDocument()
    })
  })

  it('renders resolution status labels', async () => {
    render(<Wrapper><WarehouseReconciliationExceptionsPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getAllByText(/open|in-progress/i).length).toBeGreaterThan(0)
    })
  })

  it('shows panel container before data loads', () => {
    render(<Wrapper><WarehouseReconciliationExceptionsPanel request={request} /></Wrapper>)
    expect(document.querySelector('[data-testid="evidence-panel-warehouse-reconciliation-exceptions"]')).not.toBeNull()
  })
})
