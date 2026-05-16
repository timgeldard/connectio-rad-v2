import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TraceGraphPanel } from './trace-graph-panel.js'
import type { TraceGraph } from '@connectio/data-contracts'

// ---------------------------------------------------------------------------
// Mock @xyflow/react — jsdom lacks ResizeObserver and SVG layout
// ---------------------------------------------------------------------------

vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ nodes, onNodeClick }: { nodes: { id: string; data: { node: { materialDescription: string } } }[]; onNodeClick?: (evt: unknown, node: unknown) => void }) => (
    <div data-testid="react-flow">
      {nodes.map(n => (
        <button
          key={n.id}
          data-testid={`node-${n.id}`}
          onClick={evt => onNodeClick?.(evt, n)}
        >
          {n.data.node.materialDescription}
        </button>
      ))}
    </div>
  ),
  Background: () => null,
  Controls: () => null,
  useNodesState: (init: unknown[]) => {
    const { useState } = require('react')
    const [nodes, setNodes] = useState(init)
    return [nodes, setNodes, () => {}]
  },
  useEdgesState: (init: unknown[]) => {
    const { useState } = require('react')
    const [edges] = useState(init)
    return [edges, () => {}, () => {}]
  },
}))

// ---------------------------------------------------------------------------
// Mock EvidencePanel runtime
// ---------------------------------------------------------------------------

vi.mock('@connectio/evidence-panel-runtime', () => ({
  EvidencePanel: ({ children }: { children?: React.ReactNode }) => <div data-testid="evidence-panel">{children}</div>,
  useEvidencePanel: () => ({ displayState: 'ready', markReady: vi.fn(), markError: vi.fn() }),
}))

// ---------------------------------------------------------------------------
// Mock useTraceGraph
// ---------------------------------------------------------------------------

vi.mock('../adapters/trace2-queries.js', () => ({
  useTraceGraph: vi.fn(),
}))

import { useTraceGraph } from '../adapters/trace2-queries.js'

const mockGraph: TraceGraph = {
  direction: 'both',
  depth: 2,
  rootBatch: 'BATCH-ROOT',
  upstreamCount: 1,
  downstreamCount: 1,
  unresolvedNodeCount: 0,
  nodes: [
    { id: 'root', type: 'finished-good', materialId: 'MAT-001', batchId: 'BATCH-ROOT', materialDescription: 'Root Cheese Block', quantity: 100, uom: 'KG', status: 'resolved', riskLevel: 'high' },
    { id: 'up1', type: 'raw-material', materialId: 'MAT-002', batchId: 'BATCH-UP1', materialDescription: 'Raw Milk', quantity: 1000, uom: 'L', status: 'resolved', riskLevel: 'low' },
    { id: 'dn1', type: 'customer-delivery', materialId: 'MAT-001', batchId: 'BATCH-DN1', materialDescription: 'Delivery DE', quantity: 60, uom: 'KG', status: 'unresolved', riskLevel: 'critical' },
  ],
  edges: [
    { id: 'e1', source: 'up1', target: 'root', relationshipType: 'component-of', quantity: 1000, uom: 'L' },
    { id: 'e2', source: 'root', target: 'dn1', relationshipType: 'delivered-to', quantity: 60, uom: 'KG' },
  ],
}

const request = { investigationId: 'INV-001', batchId: 'BATCH-ROOT' }

beforeEach(() => {
  vi.mocked(useTraceGraph).mockReturnValue({
    data: { ok: true, data: mockGraph, fetchedAt: '2024-03-08T15:00:00.000Z', source: 'mock' },
    isLoading: false,
  } as ReturnType<typeof useTraceGraph>)
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TraceGraphPanel', () => {
  it('renders the React Flow component when data is available', () => {
    render(<TraceGraphPanel request={request} />)
    expect(screen.getByTestId('react-flow')).toBeDefined()
  })

  it('renders a node button for each graph node', () => {
    render(<TraceGraphPanel request={request} />)
    expect(screen.getByTestId('node-root')).toBeDefined()
    expect(screen.getByTestId('node-up1')).toBeDefined()
    expect(screen.getByTestId('node-dn1')).toBeDefined()
  })

  it('shows summary stats', () => {
    render(<TraceGraphPanel request={request} />)
    expect(screen.getByText('Upstream')).toBeDefined()
    expect(screen.getByText('Downstream')).toBeDefined()
    expect(screen.getByText('Depth')).toBeDefined()
    expect(screen.getByText('Unresolved')).toBeDefined()
  })

  it('shows the root batch identifier', () => {
    render(<TraceGraphPanel request={request} />)
    expect(screen.getByText('BATCH-ROOT')).toBeDefined()
  })

  it('shows the hint text when no node is selected', () => {
    render(<TraceGraphPanel request={request} />)
    expect(screen.getByText(/click a node/i)).toBeDefined()
  })

  it('shows selected node details when a node is clicked', () => {
    render(<TraceGraphPanel request={request} />)
    fireEvent.click(screen.getByTestId('node-dn1'))
    expect(screen.getByText('Selected node')).toBeDefined()
    expect(screen.getByText('Delivery DE')).toBeDefined()
  })

  it('deselects a node when clicked again', () => {
    render(<TraceGraphPanel request={request} />)
    fireEvent.click(screen.getByTestId('node-dn1'))
    expect(screen.getByText('Selected node')).toBeDefined()
    fireEvent.click(screen.getByTestId('node-dn1'))
    expect(screen.queryByText('Selected node')).toBeNull()
  })

  it('switches selection between two nodes', () => {
    render(<TraceGraphPanel request={request} />)
    fireEvent.click(screen.getByTestId('node-root'))
    expect(screen.getByText('Root Cheese Block')).toBeDefined()
    fireEvent.click(screen.getByTestId('node-up1'))
    expect(screen.getByText('Raw Milk')).toBeDefined()
  })

  it('wraps content in the EvidencePanel', () => {
    render(<TraceGraphPanel request={request} />)
    expect(screen.getByTestId('evidence-panel')).toBeDefined()
  })

  it('renders nothing inside EvidencePanel when data is unavailable', () => {
    vi.mocked(useTraceGraph).mockReturnValue({
      data: { ok: false, error: { code: 'unknown', message: 'No data', retryable: true }, displayState: 'error', source: 'mock' },
      isLoading: false,
    } as ReturnType<typeof useTraceGraph>)

    render(<TraceGraphPanel request={request} />)
    expect(screen.queryByTestId('react-flow')).toBeNull()
  })

  it('renders nothing inside EvidencePanel while loading', () => {
    vi.mocked(useTraceGraph).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useTraceGraph>)

    render(<TraceGraphPanel request={request} />)
    expect(screen.queryByTestId('react-flow')).toBeNull()
  })
})
