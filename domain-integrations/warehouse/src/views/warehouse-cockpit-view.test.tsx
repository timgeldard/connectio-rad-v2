// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@testing-library/jest-dom'
import { WarehouseCockpitView } from './warehouse-cockpit-view.js'
import { warehouse360AdapterInstance } from '../adapters/warehouse-360-adapter-factory.js'
import type { Warehouse360AdapterRequest } from '../adapters/warehouse-360-adapter.js'

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

const mockRequest: Warehouse360AdapterRequest = {
  warehouseId: '',
  plantId: 'C061',
}

describe('WarehouseCockpitView', () => {
  it('renders initial form and helper instructions when warehouseId is empty', () => {
    document.body.innerHTML = ''
    cleanup()
    render(
      <Wrapper>
        <WarehouseCockpitView request={mockRequest} />
      </Wrapper>
    )

    // Verify header status is present
    expect(screen.getByText('Warehouse360 Cockpit (Native)')).toBeInTheDocument()
    expect(screen.getByText('API Mode: mock (Fixture Data)')).toBeInTheDocument()
    expect(screen.getByText('UAT Verification Pending by Claude')).toBeInTheDocument()
    
    // Verify helper instruction banner is shown when no warehouse is entered
    expect(screen.getByText('Enter a Warehouse ID to Begin Queries')).toBeInTheDocument()
    expect(screen.getByText(/To verify native Databricks connectivity/i)).toBeInTheDocument()
  })

  it('displays inline validation error when attempting to run query with blank warehouseId', async () => {
    document.body.innerHTML = ''
    cleanup()
    render(
      <Wrapper>
        <WarehouseCockpitView request={mockRequest} />
      </Wrapper>
    )

    // Click demo autofill to verify it works, then reset it
    const demoButton = screen.getByText(/Load demo presets for offline testing/i)
    fireEvent.click(demoButton)
    
    const whInput = screen.getByPlaceholderText('e.g. WH001') as HTMLInputElement
    expect(whInput.value).toBe('WH001')

    // Reset
    const resetButton = screen.getByText('Reset')
    fireEvent.click(resetButton)
    expect(whInput.value).toBe('')

    // Try to run
    const runButton = screen.getByRole('button', { name: /Run Cockpit Queries/i })
    fireEvent.click(runButton)

    // Verify error is shown
    expect(await screen.findByText(/Warehouse ID is required/i)).toBeInTheDocument()
  })

  it('queries backend concurrently and renders data tabs, metrics, derived workload, and collapsible technical details', async () => {
    document.body.innerHTML = ''
    cleanup()
    // Spy on and mock the factory adapter's native methods explicitly
    const spyOverview = vi.spyOn(warehouse360AdapterInstance, 'getWarehouseOverview').mockResolvedValue({
      ok: true,
      fetchedAt: new Date().toISOString(),
      source: 'mock',
      data: {
        plantId: 'C061',
        warehouseId: 'WH001',
        inboundDueCount: 10,
        inboundOverdueCount: 2,
        outboundDueCount: 10,
        outboundOverdueCount: 3,
        stagingOpenCount: 10,
        stagingOverdueCount: 4,
        nearExpiryCount: 4,
        reconciliationExceptionCount: 10,
        blockedStockCount: 2,
      }
    })
    const spyInbound = vi.spyOn(warehouse360AdapterInstance, 'getWarehouseInbound').mockResolvedValue({
      ok: true,
      fetchedAt: new Date().toISOString(),
      source: 'mock',
      data: Array(10).fill({
        purchaseOrderId: 'STO-001',
        stockTransportOrderId: 'STO-001',
        materialId: 'MAT-001',
        materialDescription: 'Sugar',
        quantity: 100,
        unitOfMeasure: 'KG',
        supplyingPlantId: 'IE10',
        status: 'pending',
        documentType: 'STO',
        expectedDate: '2026-05-18'
      })
    })
    const spyOutbound = vi.spyOn(warehouse360AdapterInstance, 'getWarehouseOutbound').mockResolvedValue({
      ok: true,
      fetchedAt: new Date().toISOString(),
      source: 'mock',
      data: Array(10).fill({
        deliveryId: 'DLV-001',
        customerName: 'Client A',
        materialId: 'MAT-002',
        quantity: 50,
        scheduledDate: '2026-05-18',
        status: 'pending',
        deliveryItemId: '000010',
        salesOrderId: 'SO-123'
      })
    })
    const spyStaging = vi.spyOn(warehouse360AdapterInstance, 'getWarehouseStaging').mockResolvedValue({
      ok: true,
      fetchedAt: new Date().toISOString(),
      source: 'mock',
      data: Array(10).fill({
        orderId: 'STG-001',
        materialId: 'MAT-003',
        requiredQty: 200,
        stagedQty: 150,
        stageLocation: 'LOC-A'
      })
    })
    const spyExceptions = vi.spyOn(warehouse360AdapterInstance, 'getWarehouseExceptionItems').mockResolvedValue({
      ok: true,
      fetchedAt: new Date().toISOString(),
      source: 'mock',
      data: Array(10).fill({
        itemId: 'EXC-001',
        exceptionType: 'Shortage',
        materialId: 'MAT-001',
        severity: 'high',
        description: 'Under-delivery'
      })
    })

    render(
      <Wrapper>
        <WarehouseCockpitView request={mockRequest} />
      </Wrapper>
    )

    // Load demo presets
    const demoButton = screen.getByText(/Load demo presets for offline testing/i)
    fireEvent.click(demoButton)

    // Wait for state updates to flush to the input
    await waitFor(() => {
      const whInput = screen.getByPlaceholderText('e.g. WH001') as HTMLInputElement
      expect(whInput.value).toBe('WH001')
    })

    // Click run cockpit queries
    const runButton = screen.getByRole('button', { name: /Run Cockpit Queries/i })
    fireEvent.click(runButton)

    // Wait for queries to complete and render overview metrics cards
    await waitFor(() => {
      expect(spyOverview).toHaveBeenCalledWith({
        warehouseId: 'WH001',
        plantId: 'C061',
        dateFrom: '2026-01-01',
        dateTo: '2026-05-18',
        limit: 100
      })
      expect(spyInbound).toHaveBeenCalledWith({
        warehouseId: 'WH001',
        plantId: 'C061',
        dateFrom: '2026-01-01',
        dateTo: '2026-05-18',
        limit: 100
      })
      expect(spyOutbound).toHaveBeenCalledWith({
        warehouseId: 'WH001',
        plantId: 'C061',
        dateFrom: '2026-01-01',
        dateTo: '2026-05-18',
        limit: 100
      })
      expect(spyStaging).toHaveBeenCalledWith({
        warehouseId: 'WH001',
        plantId: 'C061',
        dateFrom: '2026-01-01',
        dateTo: '2026-05-18',
        limit: 100
      })
      expect(spyExceptions).toHaveBeenCalledWith({
        warehouseId: 'WH001',
        plantId: 'C061',
        dateFrom: '2026-01-01',
        dateTo: '2026-05-18',
        limit: 100
      })

      // Inbound count (10 from mock data in warehouse-360-adapter)
      expect(screen.getByText('INBOUND OPERATIONS')).toBeInTheDocument()
      // Outbound count (10 from mock data)
      expect(screen.getByText('OUTBOUND SHIPMENTS')).toBeInTheDocument()
      // Staging count (10 from mock data)
      expect(screen.getByText('PRODUCTION STAGING')).toBeInTheDocument()
    })

    // Assert derived statistics card calculated active workload summary properly
    // Mock data has 10 inbound, 10 outbound, 10 staging = 30 open rows total
    expect(screen.getByText(/Active Screen Workload Summary/i)).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument() // 30 Open Rows
    expect(screen.getByText('Open Rows')).toBeInTheDocument()

    // Assert tab content counts render
    expect(screen.getByText(/Inbound Receipts \(10\)/i)).toBeInTheDocument()
    expect(screen.getByText(/Outbound Deliveries \(10\)/i)).toBeInTheDocument()
    expect(screen.getByText(/Production Staging \(10\)/i)).toBeInTheDocument()
    expect(screen.getByText(/Exceptions & Alerts \(10\)/i)).toBeInTheDocument()

    // Row selection and detailed inspector validation
    const row = screen.getAllByText('STO-001')[0] // A known mock STO ID string
    expect(row).toBeInTheDocument()

    // Click STO-001 row
    fireEvent.click(row)

    // Verify row detailed inspector details card is rendered
    expect(screen.getByText(/Selected Item Inspector Details/i)).toBeInTheDocument()
    expect(screen.getAllByText('STO-001').length).toBeGreaterThan(0)
    expect(screen.getByText('purchaseOrderId')).toBeInTheDocument()
    expect(screen.getByText('supplyingPlantId')).toBeInTheDocument()

    // Verify absolute read-only constraints: no goods receipt postings, no confirmations
    expect(screen.queryByText(/Confirm Goods Receipt/i)).toBeNull()
    expect(screen.queryByText(/Confirm Staging/i)).toBeNull()
    expect(screen.queryByText(/Post Goods Issue/i)).toBeNull()

    // Technical Diagnostics collapsible validation
    const devHeader = screen.getByText(/Developer Diagnostic Technical Logs/i)
    expect(devHeader).toBeInTheDocument()

    // Click developer header
    fireEvent.click(devHeader)

    // Verify pre request filters are shown
    expect(screen.getByText(/"warehouseId": "WH001"/i)).toBeInTheDocument()
    expect(screen.getByText('/api/warehouse360/inbound')).toBeInTheDocument()
    expect(screen.getByText('/api/warehouse360/exceptions')).toBeInTheDocument()
  })
})
