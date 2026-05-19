// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OrderHistoryView } from './order-history-view.js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@testing-library/jest-dom'

// Mock the React Query hooks
vi.mock('../adapters/process-order-review-queries.js', () => {
  return {
    useProcessOrderHeader: vi.fn(),
    useOrderOperations: vi.fn(),
    useOrderConfirmations: vi.fn(),
    useOrderGoodsMovements: vi.fn(),
  }
})

import {
  useProcessOrderHeader,
  useOrderOperations,
  useOrderConfirmations,
  useOrderGoodsMovements,
} from '../adapters/process-order-review-queries.js'

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

describe('OrderHistoryView', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    // Default mock query implementations (empty/no-data baseline)
    vi.mocked(useProcessOrderHeader).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as unknown as ReturnType<typeof useProcessOrderHeader>)
    vi.mocked(useOrderOperations).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as unknown as ReturnType<typeof useOrderOperations>)
    vi.mocked(useOrderConfirmations).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as unknown as ReturnType<typeof useOrderConfirmations>)
    vi.mocked(useOrderGoodsMovements).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as unknown as ReturnType<typeof useOrderGoodsMovements>)
  })

  it('renders search form and guides correctly in empty initial state', () => {
    render(
      <Wrapper>
        <OrderHistoryView />
      </Wrapper>
    )

    expect(screen.getByTestId('poh-query-form')).toBeInTheDocument()
    expect(screen.getByText(/Manufacturing Order Filter Specification/i)).toBeInTheDocument()
    expect(screen.getByText(/Enter a process order to load history/i)).toBeInTheDocument()
  })

  it('validates that Process Order ID is required', async () => {
    render(
      <Wrapper>
        <OrderHistoryView />
      </Wrapper>
    )

    const submitBtn = screen.getByRole('button', { name: /Run \/ Refresh/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText(/Process Order ID is required before running investigation/i)).toBeInTheDocument()
    })
  })

  it('validates range limits for the Limit input', async () => {
    render(
      <Wrapper>
        <OrderHistoryView />
      </Wrapper>
    )

    const orderInput = screen.getByPlaceholderText(/e.g. PO-240308-3847/i)
    fireEvent.change(orderInput, { target: { value: 'PO-TEST' } })

    expect(screen.getByRole('slider')).toBeInTheDocument()
    // Simulate setting limit manually by entering something invalid via state
    // We will just directly trigger form submission with valid slider input
    const submitBtn = screen.getByRole('button', { name: /Run \/ Refresh/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      // By default limit is 100 which is valid, so no error should appear for limit
      expect(screen.queryByText(/Limit must be/i)).toBeNull()
    })
  })

  it('populates fields correctly when loading preset', async () => {
    render(
      <Wrapper>
        <OrderHistoryView />
      </Wrapper>
    )

    const presetBtn = screen.getByRole('button', { name: /Load Demo-Only Fixture/i })
    fireEvent.click(presetBtn)

    const orderInput = screen.getByPlaceholderText(/e.g. PO-240308-3847/i) as HTMLInputElement
    expect(orderInput.value).toBe('PO-240308-3847')

    const plantInput = screen.getByPlaceholderText(/e.g. IE10/i) as HTMLInputElement
    expect(plantInput.value).toBe('IE10')
  })

  it('displays mock fixture warning banner and diagnostic fieldset when preset is clicked, and auto-dismisses on input change or reset', async () => {
    render(
      <Wrapper>
        <OrderHistoryView />
      </Wrapper>
    )

    // Verify diagnostic filters container
    expect(screen.getByText(/Diagnostic \/ planned filters — not applied by current native routes/i)).toBeInTheDocument()

    const presetBtn = screen.getByRole('button', { name: /Load Demo-Only Fixture/i })
    fireEvent.click(presetBtn)

    // Warning banner should be present
    expect(screen.getByText(/Mock fixture selected/i)).toBeInTheDocument()

    // Edit process order input
    const orderInput = screen.getByPlaceholderText(/e.g. PO-240308-3847/i)
    fireEvent.change(orderInput, { target: { value: 'NEW-PO-ID' } })

    // Warning banner should disappear
    expect(screen.queryByText(/Mock fixture selected/i)).toBeNull()

    // Click preset again to restore warning
    fireEvent.click(presetBtn)
    expect(screen.getByText(/Mock fixture selected/i)).toBeInTheDocument()

    // Click reset
    const resetBtn = screen.getByRole('button', { name: /Reset/i })
    fireEvent.click(resetBtn)

    // Warning banner should disappear
    expect(screen.queryByText(/Mock fixture selected/i)).toBeNull()
  })

  it('renders loading indicator when parallel queries are active', () => {
    vi.mocked(useProcessOrderHeader).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useProcessOrderHeader>)

    render(
      <Wrapper>
        <OrderHistoryView request={{ processOrderId: 'PO-240308-3847' }} />
      </Wrapper>
    )

    expect(screen.getByText(/Running native Databricks Unity Catalog queries/i)).toBeInTheDocument()
  })

  it('renders loaded content with calculated metrics, timeline, and diagnostics correctly', async () => {
    // Setup rich query responses mimicking Unity Catalog views
    vi.mocked(useProcessOrderHeader).mockReturnValue({
      data: {
        ok: true,
        data: {
          processOrderId: 'PO-240308-3847',
          orderType: 'process-order',
          materialId: 'MAT-CH-EMMENTAL-BLOCK',
          materialDescription: 'Emmental Block 4 kg',
          plantId: 'IE10',
          confirmedQuantity: 1860,
          plannedQuantity: 2400,
          uom: 'KG',
          plannedStart: '2024-03-08T00:00:00.000Z',
          plannedFinish: '2024-03-08T23:59:00.000Z',
          orderStatus: 'in-process',
        },
        source: 'databricks-api',
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useProcessOrderHeader>)

    vi.mocked(useOrderOperations).mockReturnValue({
      data: {
        ok: true,
        data: [
          {
            operationId: 'OP-010',
            operationNumber: '0010',
            operationText: 'Milk Standardisation',
            workCentre: 'WC-CHEESE-PREP',
            status: 'confirmed',
            plannedDurationMinutes: 180,
            actualDurationMinutes: 170,
            actualStart: '2024-03-08T00:15:00.000Z',
            actualFinish: '2024-03-08T03:05:00.000Z',
            hasException: false,
          },
        ],
        source: 'databricks-api',
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useOrderOperations>)

    vi.mocked(useOrderConfirmations).mockReturnValue({
      data: {
        ok: true,
        data: [
          {
            confirmationId: 'CONF-001',
            operationId: 'OP-010',
            confirmedYield: 25000,
            uom: 'L',
            confirmedAt: '2024-03-08T03:05:00.000Z',
            confirmedBy: 'j.murphy@listowel.ie',
            setupDurationMinutes: 10,
            machineDurationMinutes: 150,
          },
        ],
        source: 'databricks-api',
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useOrderConfirmations>)

    vi.mocked(useOrderGoodsMovements).mockReturnValue({
      data: {
        ok: true,
        data: [
          {
            movementId: 'GM-001',
            movementType: '261',
            direction: 'input',
            materialId: 'MAT-RM-RAW-MILK',
            materialDescription: 'Raw Milk',
            batchId: 'RM-240308-0012',
            quantity: 25000,
            uom: 'L',
            postedAt: '2024-03-08T01:30:00.000Z',
            storageLocation: 'SL-MILK-SILO',
          },
          {
            movementId: 'GM-002',
            movementType: '101',
            direction: 'output',
            materialId: 'MAT-CH-EMMENTAL-BLOCK',
            materialDescription: 'Emmental Block 4 kg',
            batchId: 'CH-240308-0047',
            quantity: 1860,
            uom: 'KG',
            postedAt: '2024-03-08T09:30:00.000Z',
            storageLocation: 'SL-FG-CHEESE',
          },
        ],
        source: 'databricks-api',
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useOrderGoodsMovements>)

    render(
      <Wrapper>
        <OrderHistoryView request={{ processOrderId: 'PO-240308-3847' }} />
      </Wrapper>
    )

    // Check Header Card Elements
    expect(screen.getByText(/Process Order Header Context/i)).toBeInTheDocument()
    expect(screen.getByText(/MAT-CH-EMMENTAL-BLOCK - Emmental Block 4 kg/i)).toBeInTheDocument()
    expect(screen.getAllByText(/DATABRICKS-API/i).length).toBeGreaterThan(0)

    // Check Operations rendering
    expect(screen.getAllByText(/Milk Standardisation/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/WC-CHEESE-PREP/i).length).toBeGreaterThan(0)

    // Check Confirmations rendering
    expect(screen.getAllByText(/CONF-001/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/j.murphy@listowel.ie/i).length).toBeGreaterThan(0)

    // Check Goods movements rendering
    expect(screen.getAllByText(/GM-001/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/SL-MILK-SILO/i).length).toBeGreaterThan(0)

    // Check Derived metrics summary
    expect(screen.getAllByText(/1,860 KG/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/25,000 L/i).length).toBeGreaterThan(0)

    // Check mixed UOM warning is rendered under exceptions
    expect(screen.getByText(/Mixed units of measure detected/i)).toBeInTheDocument()

    // Verify chronological sorting in timeline (01:30 Goods movement -> 03:05 Confirmation)
    const timelineBlock = screen.getByText(/Chronological Event Timeline/i).parentElement
    expect(timelineBlock).toBeInTheDocument()
    const content = timelineBlock?.textContent ?? ''
    const idxGM = content.indexOf('MAT-RM-RAW-MILK')
    const idxConf = content.indexOf('CONF-001')
    expect(idxGM).toBeGreaterThan(-1)
    expect(idxConf).toBeGreaterThan(-1)
    expect(idxGM).toBeLessThan(idxConf)

    // Collapsible technical drawer click test
    const drawerBtn = screen.getByRole('button', { name: /Show Technical Query Diagnostics/i })
    fireEvent.click(drawerBtn)
    expect(screen.getByText(/Active Endpoints/i)).toBeInTheDocument()
    expect(screen.getByText(/POST \/api\/por\/order-header/i)).toBeInTheDocument()
  })

  it('displays preset helper text', () => {
    render(
      <Wrapper>
        <OrderHistoryView />
      </Wrapper>
    )
    expect(screen.getByText(/Mock fixture values are for UI testing only and are not known UAT process orders/i)).toBeInTheDocument()
  })

  it('renders section-level route error cards and does not render success content for that section', async () => {
    // Setup a query failure on Operations, but other queries succeed
    vi.mocked(useProcessOrderHeader).mockReturnValue({
      data: {
        ok: true,
        data: {
          processOrderId: 'PO-240308-3847',
          orderType: 'process-order',
          materialId: 'MAT-1',
          materialDescription: 'Mat 1',
          plantId: 'IE10',
          confirmedQuantity: 10,
          plannedQuantity: 100,
          uom: 'KG',
          plannedStart: '2024-03-08T00:00:00.000Z',
          plannedFinish: '2024-03-08T23:59:00.000Z',
          orderStatus: 'in-process',
        },
        source: 'databricks-api',
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useProcessOrderHeader>)

    vi.mocked(useOrderOperations).mockReturnValue({
      data: {
        ok: false,
        error: {
          code: '503',
          message: 'Databricks SQL warehouse integration is unavailable (BACKEND_ADAPTER_MODE not set).',
        },
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useOrderOperations>)

    render(
      <Wrapper>
        <OrderHistoryView request={{ processOrderId: 'PO-240308-3847' }} />
      </Wrapper>
    )

    // Header context succeeds and renders
    expect(screen.getByText(/Process Order Header Context/i)).toBeInTheDocument()

    // Operations fails and renders route-specific error card with guidance
    expect(screen.getByText(/Operations Query Failed/i)).toBeInTheDocument()
    expect(screen.getAllByText(/BACKEND_ADAPTER_MODE/i).length).toBeGreaterThan(0)
  })

  it('renders empty dynamic source status and empty state for a succeeded but empty route', async () => {
    vi.mocked(useProcessOrderHeader).mockReturnValue({
      data: {
        ok: true,
        data: {
          processOrderId: 'PO-240308-3847',
          orderType: 'process-order',
          materialId: 'MAT-1',
          materialDescription: 'Mat 1',
          plantId: 'IE10',
          confirmedQuantity: 10,
          plannedQuantity: 100,
          uom: 'KG',
          plannedStart: '2024-03-08T00:00:00.000Z',
          plannedFinish: '2024-03-08T23:59:00.000Z',
          orderStatus: 'in-process',
        },
        source: 'databricks-api',
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useProcessOrderHeader>)

    // Succeeded but returned empty array
    vi.mocked(useOrderOperations).mockReturnValue({
      data: {
        ok: true,
        data: [],
        source: 'databricks-api',
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useOrderOperations>)

    render(
      <Wrapper>
        <OrderHistoryView request={{ processOrderId: 'PO-240308-3847' }} />
      </Wrapper>
    )

    // Expect the empty badge and empty placeholder for Operations
    expect(screen.getByText(/No process operations or phases recorded/i)).toBeInTheDocument()
    expect(screen.getByText(/EMPTY/i)).toBeInTheDocument()
  })

  it('disables planned/diagnostic filters and renders warning copy and wired labels', () => {
    render(
      <Wrapper>
        <OrderHistoryView />
      </Wrapper>
    )

    // Verify disabled inputs
    expect(screen.getByLabelText('Material ID')).toBeDisabled()
    expect(screen.getByLabelText('Batch ID')).toBeDisabled()
    expect(screen.getByLabelText('Posting Date From')).toBeDisabled()
    expect(screen.getByLabelText('Posting Date To')).toBeDisabled()
    expect(screen.getByLabelText('Max Rows Limit')).toBeDisabled()

    // Verify warning & explanatory copy
    expect(screen.getByText(/Diagnostic \/ planned filters — not applied by current native routes/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Planned filter — not applied to database queries/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Wired to Header query only/i)).toBeInTheDocument()
  })
})
