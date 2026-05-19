import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ControlChartPanel } from './control-chart-panel.js'
import type { SPCMonitoringAdapterRequest } from '../adapters/spc-monitoring-adapter.js'
import * as queries from '../adapters/spc-monitoring-queries.js'

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } })
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={makeQueryClient()}>{children}</QueryClientProvider>
}

const request: SPCMonitoringAdapterRequest = {
  plantId: 'IE10',
  workCentreId: 'WC-IE10-PASTEURISATION',
}

vi.mock('../adapters/spc-monitoring-queries.js', async (importOriginal) => {
  const actual = await importOriginal<typeof queries>()
  return {
    ...actual,
    useControlChartSeries: vi.fn(),
  }
})

const defaultMockSeries = {
  chartId: 'CHART-IE10-PH-EMMENTAL-001',
  chartType: 'xbar-r',
  characteristicId: 'CHAR-PH-001',
  characteristicName: 'pH',
  centerLine: 6.58,
  upperControlLimit: 6.85,
  lowerControlLimit: 6.31,
  upperSpecLimit: 6.90,
  lowerSpecLimit: 6.20,
  unitOfMeasure: 'pH',
  confidence: 0.95,
  points: [
    { pointId: 'PT-001', timestamp: '2026-05-13T06:00:00.000Z', value: 6.55, batchId: 'CH-240307-0031', sampleId: 'SMP-0031-001', signalIds: [], status: 'in-control' },
    { pointId: 'PT-002', timestamp: '2026-05-13T09:00:00.000Z', value: 6.60, batchId: 'CH-240307-0031', sampleId: 'SMP-0031-002', signalIds: [], status: 'in-control' },
    { pointId: 'PT-003', timestamp: '2026-05-13T12:00:00.000Z', value: 6.52, batchId: 'CH-240307-0031', sampleId: 'SMP-0031-003', signalIds: [], status: 'in-control' },
  ],
}

describe('ControlChartPanel', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(queries.useControlChartSeries).mockReturnValue({
      data: { ok: true, data: defaultMockSeries, fetchedAt: '2026-05-18T12:00:00.000Z' },
      isLoading: false,
    } as unknown as ReturnType<typeof queries.useControlChartSeries>)
  })

  it('renders without crashing', () => {
    render(<Wrapper><ControlChartPanel request={request} /></Wrapper>)
  })

  it('renders the panel container with correct data-testid', async () => {
    render(<Wrapper><ControlChartPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="evidence-panel-control-chart"]')).not.toBeNull()
    })
  })

  it('renders the panel display name', async () => {
    render(<Wrapper><ControlChartPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText('Control Chart')).toBeInTheDocument()
    })
  })

  it('renders Control Limits and Specification Limits headers and values', async () => {
    render(<Wrapper><ControlChartPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText('Control Limits:')).toBeInTheDocument()
      expect(screen.getByText('Specification Limits:')).toBeInTheDocument()
      expect(screen.getByText('UCL')).toBeInTheDocument()
      expect(screen.getByText('CL')).toBeInTheDocument()
      expect(screen.getByText('LCL')).toBeInTheDocument()
      expect(screen.getByText('USL')).toBeInTheDocument()
      expect(screen.getByText('LSL')).toBeInTheDocument()
    })
  })

  it('renders the characteristic name and chart type after data loads', async () => {
    render(<Wrapper><ControlChartPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText(/pH — XBAR-R/)).toBeInTheDocument()
    })
  })

  it('renders an SVG element with the larger 480×180 viewBox', async () => {
    render(<Wrapper><ControlChartPanel request={request} /></Wrapper>)
    await waitFor(() => {
      const svg = document.querySelector('svg[width="480"][height="180"]')
      expect(svg).not.toBeNull()
    })
  })

  it('renders data point circles inside the SVG', async () => {
    render(<Wrapper><ControlChartPanel request={request} /></Wrapper>)
    await waitFor(() => {
      const circles = document.querySelectorAll('svg circle')
      expect(circles.length).toBe(3)
    })
  })

  it('renders the chart legend items', async () => {
    render(<Wrapper><ControlChartPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText('In control')).toBeInTheDocument()
      expect(screen.getByText('Warning')).toBeInTheDocument()
      expect(screen.getByText('Out of control')).toBeInTheDocument()
    })
  })

  // --- Defensive Rendering Tests ---

  it('renders an empty state when no points exist', async () => {
    vi.mocked(queries.useControlChartSeries).mockReturnValue({
      data: {
        ok: true,
        data: { ...defaultMockSeries, points: [] },
        fetchedAt: '2026-05-18T12:00:00.000Z',
      },
      isLoading: false,
    } as unknown as ReturnType<typeof queries.useControlChartSeries>)

    render(<Wrapper><ControlChartPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText('No measurement data found for this characteristic.')).toBeInTheDocument()
    })
  })

  it('renders an indicative only warning when points count < 3', async () => {
    vi.mocked(queries.useControlChartSeries).mockReturnValue({
      data: {
        ok: true,
        data: {
          ...defaultMockSeries,
          points: [
            { pointId: 'PT-001', timestamp: '2026-05-13T06:00:00.000Z', value: 6.55, signalIds: [], status: 'in-control' },
          ],
        },
        fetchedAt: '2026-05-18T12:00:00.000Z',
      },
      isLoading: false,
    } as unknown as ReturnType<typeof queries.useControlChartSeries>)

    render(<Wrapper><ControlChartPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText(/Fewer than 3 samples/)).toBeInTheDocument()
    })
  })

  it('renders specification limits but hides control limits when control limits are missing', async () => {
    vi.mocked(queries.useControlChartSeries).mockReturnValue({
      data: {
        ok: true,
        data: {
          ...defaultMockSeries,
          centerLine: undefined,
          upperControlLimit: undefined,
          lowerControlLimit: undefined,
        },
        fetchedAt: '2026-05-18T12:00:00.000Z',
      },
      isLoading: false,
    } as unknown as ReturnType<typeof queries.useControlChartSeries>)

    render(<Wrapper><ControlChartPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.queryByText('Control Limits:')).toBeNull()
      expect(screen.getByText('Specification Limits:')).toBeInTheDocument()
      expect(screen.getByText('USL')).toBeInTheDocument()
      expect(screen.getByText('LSL')).toBeInTheDocument()
      expect(screen.queryByText('UCL')).toBeNull()
      expect(screen.queryByText('LCL')).toBeNull()
    })
  })
})
