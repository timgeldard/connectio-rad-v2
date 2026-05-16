import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ControlChartPanel } from './control-chart-panel.js'
import type { SPCMonitoringAdapterRequest } from '../adapters/spc-monitoring-adapter.js'

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

describe('ControlChartPanel', () => {
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

  it('renders UCL, CL, and LCL stat labels after data loads', async () => {
    render(<Wrapper><ControlChartPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText('UCL')).toBeInTheDocument()
      expect(screen.getByText('CL')).toBeInTheDocument()
      expect(screen.getByText('LCL')).toBeInTheDocument()
    })
  })

  it('renders the characteristic name and chart type after data loads', async () => {
    render(<Wrapper><ControlChartPanel request={request} /></Wrapper>)
    // Mock data: characteristicName 'pH', chartType 'xbar-r' → rendered as "pH — XBAR-R (pH) · N points"
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
      // Mock data has at least one point
      expect(circles.length).toBeGreaterThan(0)
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
})
