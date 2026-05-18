import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Trace2LegacyApiAdapter } from './trace2-legacy-api-adapter.js'
import type { Trace2AdapterRequest } from './trace2-adapter.js'
import type { BackendTraceGraphResponse } from './trace2-graph-mapper.js'

// ---------------------------------------------------------------------------
// V1-shaped batch header response fixture (snake_case)
// ---------------------------------------------------------------------------

const V1_BATCH_HEADER_OK = {
  material_id: '100023847',
  batch_id: 'CH-240308-0047',
  material_name: 'EMMENTAL BLOCK NATURAL 100KG',
  process_order: 'PO-240308-1189',
  plant_id: 'IE10',
  manufacture_date: '2024-03-08',
  expiry_date: '2024-09-08',
  uom: 'KG',
  qty_produced: 2400,
  unrestricted: 0,
  blocked: 100,
  qi: 2300,
  restricted: 0,
  transit: 0,
  batch_status: 'blocked',
}

const BASE_URL = 'http://localhost:8000'
const adapter = new Trace2LegacyApiAdapter(BASE_URL)

const fullRequest: Trace2AdapterRequest = {
  investigationId: 'INV-001',
  batchId: 'CH-240308-0047',
  materialId: '100023847',
  plantId: 'IE10',
}

const partialRequest: Trace2AdapterRequest = {
  investigationId: 'INV-001',
  // batchId and materialId intentionally absent
}

function mockFetch(status: number, body: unknown, ok = status >= 200 && status < 300) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  })
}

function mockFetchError(message = 'Network error') {
  return vi.fn().mockRejectedValue(new TypeError(message))
}

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch(200, V1_BATCH_HEADER_OK))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Trace2LegacyApiAdapter.getBatchHeaderSummary', () => {
  it('returns ok:true with source=legacy-api on a successful V1 response', async () => {
    const result = await adapter.getBatchHeaderSummary(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.source).toBe('legacy-api')
  })

  it('maps V1 snake_case fields to BatchHeaderSummary contract', async () => {
    const result = await adapter.getBatchHeaderSummary(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const d = result.data
    expect(d.materialId).toBe('100023847')
    expect(d.batchId).toBe('CH-240308-0047')
    expect(d.materialDescription).toBe('EMMENTAL BLOCK NATURAL 100KG')
    expect(d.plantId).toBe('IE10')
    expect(d.quantity).toBe(2400)
    expect(d.uom).toBe('KG')
    expect(d.processOrderId).toBe('PO-240308-1189')
  })

  it('pads bare dates to ISO 8601 format', async () => {
    const result = await adapter.getBatchHeaderSummary(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.manufactureDate).toBe('2024-03-08T00:00:00.000Z')
    expect(result.data.expiryDate).toBe('2024-09-08T00:00:00.000Z')
  })

  it('maps batch_status="blocked" → batchStatus="blocked"', async () => {
    const result = await adapter.getBatchHeaderSummary(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.batchStatus).toBe('blocked')
  })

  it('derives stockStatus from stock quantities (qi>0 → quality-inspection)', async () => {
    const result = await adapter.getBatchHeaderSummary(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // Fixture: blocked=100, qi=2300 → blocked wins
    expect(result.data.stockStatus).toBe('blocked')
  })

  it('derives releaseStatus=blocked when blocked>0', async () => {
    const result = await adapter.getBatchHeaderSummary(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.releaseStatus).toBe('blocked')
  })

  it('falls back to mock (source from super) when batchId is missing', async () => {
    const result = await adapter.getBatchHeaderSummary(partialRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // Mock returns source undefined (base adapter doesn't set source)
    expect(result.source).toBeUndefined()
    // fetch should NOT have been called
    const fetchMock = vi.mocked(global.fetch)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns ok:false with code=unauthorized on 401', async () => {
    vi.stubGlobal('fetch', mockFetch(401, {}, false))
    const result = await adapter.getBatchHeaderSummary(fullRequest)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('unauthorized')
    expect(result.source).toBe('legacy-api')
    expect(result.displayState).toBe('unauthorized')
    expect(result.error.retryable).toBe(false)
  })

  it('returns ok:false with code=not-found on 404', async () => {
    vi.stubGlobal('fetch', mockFetch(404, {}, false))
    const result = await adapter.getBatchHeaderSummary(fullRequest)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('not-found')
    expect(result.displayState).toBe('error')
  })

  it('returns ok:false with code=network on 500, retryable=true', async () => {
    vi.stubGlobal('fetch', mockFetch(500, {}, false))
    const result = await adapter.getBatchHeaderSummary(fullRequest)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('network')
    expect(result.error.retryable).toBe(true)
    expect(result.source).toBe('legacy-api')
  })

  it('returns ok:false on network failure (TypeError)', async () => {
    vi.stubGlobal('fetch', mockFetchError('Failed to fetch'))
    const result = await adapter.getBatchHeaderSummary(fullRequest)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('unknown')
    expect(result.error.retryable).toBe(true)
    expect(result.source).toBe('legacy-api')
  })

  it('includes fetchedAt ISO timestamp on success', async () => {
    const result = await adapter.getBatchHeaderSummary(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('passes material_id and batch_id as JSON body to V1', async () => {
    await adapter.getBatchHeaderSummary(fullRequest)
    const fetchMock = vi.mocked(global.fetch)
    const [url, opts] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/api/trace2/batch-header')
    const body = JSON.parse(opts?.body as string)
    expect(body.material_id).toBe('100023847')
    expect(body.batch_id).toBe('CH-240308-0047')
  })
})

// ---------------------------------------------------------------------------
// getTraceGraph tests
// ---------------------------------------------------------------------------

const ANCHOR_KEY = '20052009:0008602411:C061'
const UPSTREAM_KEY = '99000001:0001111111:C061'

const BACKEND_GRAPH_OK: BackendTraceGraphResponse = {
  anchor: { materialId: '20052009', batchId: '0008602411', plantId: 'C061', nodeKey: ANCHOR_KEY },
  nodes: [
    {
      nodeKey: ANCHOR_KEY,
      materialId: '20052009',
      batchId: '0008602411',
      plantId: 'C061',
      label: '20052009 / 0008602411',
      depth: 0,
      directions: ['anchor'],
      isAnchor: true,
    },
    {
      nodeKey: UPSTREAM_KEY,
      materialId: '99000001',
      batchId: '0001111111',
      plantId: 'C061',
      label: '99000001 / 0001111111',
      depth: 1,
      directions: ['upstream'],
      isAnchor: false,
    },
  ],
  edges: [
    {
      id: `${UPSTREAM_KEY}|${ANCHOR_KEY}|PRODUCTION||0`,
      source: UPSTREAM_KEY,
      target: ANCHOR_KEY,
      linkType: 'PRODUCTION',
      processOrderId: 'PO-001',
      materialDocumentNumber: 'MAT-001',
      purchaseOrderId: null,
      supplierId: null,
      customerId: null,
      deliveryId: null,
      salesOrderId: null,
      quantity: 100.0,
      baseUnitOfMeasure: 'KG',
      postingDate: '2026-01-01',
      movementType: '101',
      depth: 0,
      direction: 'upstream',
    },
  ],
  depthReached: 1,
  truncated: false,
  warnings: [],
}

const traceRequest: Trace2AdapterRequest = {
  investigationId: 'INV-001',
  batchId: '0008602411',
  materialId: '20052009',
  plantId: 'C061',
}

describe('Trace2LegacyApiAdapter.getTraceGraph', () => {
  it('calls POST /api/trace2/trace-graph', async () => {
    vi.stubGlobal('fetch', mockFetch(200, BACKEND_GRAPH_OK))
    await adapter.getTraceGraph(traceRequest)
    const [url, opts] = vi.mocked(global.fetch).mock.calls[0]
    expect(String(url)).toContain('/api/trace2/trace-graph')
    expect(opts?.method).toBe('POST')
    vi.unstubAllGlobals()
  })

  it('sends correct snake_case request body', async () => {
    vi.stubGlobal('fetch', mockFetch(200, BACKEND_GRAPH_OK))
    await adapter.getTraceGraph(traceRequest)
    const [, opts] = vi.mocked(global.fetch).mock.calls[0]
    const body = JSON.parse(opts?.body as string)
    expect(body.material_id).toBe('20052009')
    expect(body.batch_id).toBe('0008602411')
    expect(body.plant_id).toBe('C061')
    expect(body.direction).toBe('both')
    expect(body.max_depth).toBe(6)
    expect(body.max_edges).toBe(1000)
    vi.unstubAllGlobals()
  })

  it('returns ok:true with source=databricks-api on success', async () => {
    vi.stubGlobal('fetch', mockFetch(200, BACKEND_GRAPH_OK))
    const result = await adapter.getTraceGraph(traceRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.source).toBe('databricks-api')
    vi.unstubAllGlobals()
  })

  it('maps backend response to TraceGraph frontend contract', async () => {
    vi.stubGlobal('fetch', mockFetch(200, BACKEND_GRAPH_OK))
    const result = await adapter.getTraceGraph(traceRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const g = result.data
    expect(g.rootBatch).toBe('0008602411')
    expect(g.nodes).toHaveLength(2)
    expect(g.edges).toHaveLength(1)
    expect(g.edges[0].relationshipType).toBe('produced-from')
    expect(g.direction).toBe('both')
    vi.unstubAllGlobals()
  })

  it('preserves leading zeros in batch_id (string not numeric)', async () => {
    vi.stubGlobal('fetch', mockFetch(200, BACKEND_GRAPH_OK))
    const result = await adapter.getTraceGraph(traceRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const anchorNode = result.data.nodes.find(n => n.id === ANCHOR_KEY)
    expect(anchorNode?.batchId).toBe('0008602411')
    vi.unstubAllGlobals()
  })

  it('returns ok:false with code=unauthorized on 401 — does not use mock', async () => {
    vi.stubGlobal('fetch', mockFetch(401, {}, false))
    const result = await adapter.getTraceGraph(traceRequest)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('unauthorized')
    expect(result.source).toBe('databricks-api')
    vi.unstubAllGlobals()
  })

  it('returns ok:false with code=network on 503 — does not use mock', async () => {
    vi.stubGlobal('fetch', mockFetch(503, {}, false))
    const result = await adapter.getTraceGraph(traceRequest)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('network')
    expect(result.error.retryable).toBe(true)
    expect(result.source).toBe('databricks-api')
    vi.unstubAllGlobals()
  })

  it('returns ok:false on network error — does not use mock', async () => {
    vi.stubGlobal('fetch', mockFetchError('Failed to fetch'))
    const result = await adapter.getTraceGraph(traceRequest)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('unknown')
    expect(result.source).toBe('databricks-api')
    vi.unstubAllGlobals()
  })

  it('returns ok:false (not mock) when plantId is missing', async () => {
    const partialTraceRequest: Trace2AdapterRequest = {
      investigationId: 'INV-001',
      batchId: '0008602411',
      materialId: '20052009',
      // plantId absent
    }
    const result = await adapter.getTraceGraph(partialTraceRequest)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('not-found')
    // fetch must not have been called
    expect(vi.mocked(global.fetch)).not.toHaveBeenCalled()
    expect(result.source).toBe('databricks-api')
  })

  it('propagates warnings and truncated flag', async () => {
    const truncatedGraph: BackendTraceGraphResponse = {
      ...BACKEND_GRAPH_OK,
      truncated: true,
      warnings: ['max_edges_reached', 'max_depth_reached'],
    }
    vi.stubGlobal('fetch', mockFetch(200, truncatedGraph))
    const result = await adapter.getTraceGraph(traceRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.truncated).toBe(true)
    expect(result.data.warnings).toContain('max_edges_reached')
    expect(result.data.warnings).toContain('max_depth_reached')
    vi.unstubAllGlobals()
  })
})
