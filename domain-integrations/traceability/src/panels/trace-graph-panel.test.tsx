import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { TraceGraphPanel } from './trace-graph-panel.js'
import type { TraceGraph } from '@connectio/data-contracts'

// ---------------------------------------------------------------------------
// Mock @xyflow/react — jsdom lacks ResizeObserver and SVG layout
// ---------------------------------------------------------------------------

vi.mock('@xyflow/react', () => ({
  ReactFlow: ({
    nodes,
    edges,
    onNodeClick,
    onEdgeClick,
  }: {
    nodes: { id: string; data: { node: { materialDescription: string } } }[]
    edges: { id: string; source: string; target: string; label?: string }[]
    onNodeClick?: (evt: unknown, node: unknown) => void
    onEdgeClick?: (evt: unknown, edge: unknown) => void
  }) => (
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
      {edges.map(e => (
        <button
          key={e.id}
          data-testid={`edge-${e.id}`}
          onClick={evt => onEdgeClick?.(evt, e)}
        >
          {e.label ?? e.id}
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
    const [edges, setEdges] = useState(init)
    return [edges, setEdges, () => {}]
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
    { id: 'e1', source: 'up1', target: 'root', relationshipType: 'component-of', quantity: 1000, uom: 'L', documentReference: 'MAT-DOC-001' },
    { id: 'e2', source: 'root', target: 'dn1', relationshipType: 'delivered-to', quantity: 60, uom: 'KG', movementType: 'GD-601', documentReference: 'DO-4900089123' },
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
// Core rendering tests
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

  it('shows the hint text when no node or edge is selected', () => {
    render(<TraceGraphPanel request={request} />)
    expect(screen.getByText(/click a node or edge/i)).toBeDefined()
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

// ---------------------------------------------------------------------------
// Node selection tests
// ---------------------------------------------------------------------------

describe('TraceGraphPanel — node selection', () => {
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

  it('shows connected relationships in selected node detail', () => {
    render(<TraceGraphPanel request={request} />)
    fireEvent.click(screen.getByTestId('node-root'))
    // root has e1 (component of, incoming) and e2 (delivered to, outgoing)
    expect(screen.getByText('Relationships (2)')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Edge selection tests
// ---------------------------------------------------------------------------

describe('TraceGraphPanel — edge selection', () => {
  it('shows edge detail panel when an edge is clicked', () => {
    render(<TraceGraphPanel request={request} />)
    fireEvent.click(screen.getByTestId('edge-e1'))
    expect(screen.getByText('Selected relationship')).toBeDefined()
  })

  it('shows relationship type for the selected edge', () => {
    render(<TraceGraphPanel request={request} />)
    fireEvent.click(screen.getByTestId('edge-e1'))
    const detail = screen.getByLabelText('Selected relationship details')
    expect(within(detail).getByText('component of')).toBeDefined()
  })

  it('shows movement type when present', () => {
    render(<TraceGraphPanel request={request} />)
    fireEvent.click(screen.getByTestId('edge-e2'))
    expect(screen.getByText('GD-601')).toBeDefined()
  })

  it('shows document reference when present', () => {
    render(<TraceGraphPanel request={request} />)
    fireEvent.click(screen.getByTestId('edge-e1'))
    expect(screen.getByText('MAT-DOC-001')).toBeDefined()
  })

  it('shows source and target material descriptions', () => {
    render(<TraceGraphPanel request={request} />)
    fireEvent.click(screen.getByTestId('edge-e1'))
    const detail = screen.getByLabelText('Selected relationship details')
    expect(within(detail).getByText('Raw Milk')).toBeDefined()
    expect(within(detail).getByText('Root Cheese Block')).toBeDefined()
  })

  it('clears edge detail when edge clicked again', () => {
    render(<TraceGraphPanel request={request} />)
    fireEvent.click(screen.getByTestId('edge-e1'))
    expect(screen.getByText('Selected relationship')).toBeDefined()
    fireEvent.click(screen.getByTestId('edge-e1'))
    expect(screen.queryByText('Selected relationship')).toBeNull()
  })

  it('clears node selection when an edge is clicked', () => {
    render(<TraceGraphPanel request={request} />)
    fireEvent.click(screen.getByTestId('node-root'))
    expect(screen.getByText('Selected node')).toBeDefined()
    fireEvent.click(screen.getByTestId('edge-e1'))
    expect(screen.queryByText('Selected node')).toBeNull()
    expect(screen.getByText('Selected relationship')).toBeDefined()
  })

  it('clears edge selection when a node is clicked', () => {
    render(<TraceGraphPanel request={request} />)
    fireEvent.click(screen.getByTestId('edge-e1'))
    expect(screen.getByText('Selected relationship')).toBeDefined()
    fireEvent.click(screen.getByTestId('node-root'))
    expect(screen.queryByText('Selected relationship')).toBeNull()
    expect(screen.getByText('Selected node')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Direction toggle tests
// ---------------------------------------------------------------------------

describe('TraceGraphPanel — direction toggle', () => {
  it('renders the three direction toggle buttons', () => {
    render(<TraceGraphPanel request={request} />)
    expect(screen.getByText('Both')).toBeDefined()
    expect(screen.getByText('Downstream ↓')).toBeDefined()
    expect(screen.getByText('Upstream ↑')).toBeDefined()
  })

  it('"Downstream ↓" hides upstream nodes', () => {
    render(<TraceGraphPanel request={request} />)
    fireEvent.click(screen.getByText('Downstream ↓'))
    expect(screen.queryByTestId('node-up1')).toBeNull()
    expect(screen.getByTestId('node-root')).toBeDefined()
    expect(screen.getByTestId('node-dn1')).toBeDefined()
  })

  it('"Upstream ↑" hides downstream nodes', () => {
    render(<TraceGraphPanel request={request} />)
    fireEvent.click(screen.getByText('Upstream ↑'))
    expect(screen.queryByTestId('node-dn1')).toBeNull()
    expect(screen.getByTestId('node-root')).toBeDefined()
    expect(screen.getByTestId('node-up1')).toBeDefined()
  })

  it('"Both" restores all nodes', () => {
    render(<TraceGraphPanel request={request} />)
    fireEvent.click(screen.getByText('Downstream ↓'))
    expect(screen.queryByTestId('node-up1')).toBeNull()
    fireEvent.click(screen.getByText('Both'))
    expect(screen.getByTestId('node-up1')).toBeDefined()
  })

  it('clears selection when direction changes', () => {
    render(<TraceGraphPanel request={request} />)
    fireEvent.click(screen.getByTestId('node-root'))
    expect(screen.getByText('Selected node')).toBeDefined()
    fireEvent.click(screen.getByText('Downstream ↓'))
    expect(screen.queryByText('Selected node')).toBeNull()
  })
})
