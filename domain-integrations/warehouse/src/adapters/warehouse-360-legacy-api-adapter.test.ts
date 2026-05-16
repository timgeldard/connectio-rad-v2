import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Warehouse360LegacyApiAdapter } from './warehouse-360-legacy-api-adapter.js'
import type { Warehouse360AdapterRequest } from './warehouse-360-adapter.js'

// ---------------------------------------------------------------------------
// V1-shaped warehouse summary response fixture (snake_case)
// ---------------------------------------------------------------------------

const V1_WAREHOUSE_SUMMARY_OK = {
  warehouse_id: 'WH-IE10-MAIN',
  total_stock_lines: 412,
  unrestricted_lines: 380,
  hold_lines: 8,
  qi_lines: 24,
  open_gr: 3,
  open_gi: 5,
  open_transfers: 11,
  capacity_pct: 72.4,
  replenishment_needs: 2,
  confidence: 0.93,
}

const BASE_URL = 'http://localhost:8000'
const adapter = new Warehouse360LegacyApiAdapter(BASE_URL)

const fullRequest: Warehouse360AdapterRequest = {
  warehouseId: 'WH-IE10-MAIN',
  plantId: 'IE10',
}

const emptyRequest: Warehouse360AdapterRequest = {
  warehouseId: '',  // falsy → falls back to mock
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
  vi.stubGlobal('fetch', mockFetch(200, V1_WAREHOUSE_SUMMARY_OK))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Warehouse360LegacyApiAdapter.getWarehouse360Summary', () => {
  it('returns ok:true with source=legacy-api on a successful V1 response', async () => {
    const result = await adapter.getWarehouse360Summary(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.source).toBe('legacy-api')
  })

  it('maps V1 snake_case fields to Warehouse360Summary contract', async () => {
    const result = await adapter.getWarehouse360Summary(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const d = result.data
    expect(d.warehouseId).toBe('WH-IE10-MAIN')
    expect(d.totalStockLines).toBe(412)
    expect(d.unrestrictedLines).toBe(380)
    expect(d.holdLines).toBe(8)
    expect(d.qualityInspectionLines).toBe(24)
    expect(d.openGoodsReceipts).toBe(3)
    expect(d.openGoodsIssues).toBe(5)
    expect(d.openTransfers).toBe(11)
    expect(d.capacityUtilizationPercent).toBe(72.4)
    expect(d.activeReplenishmentNeeds).toBe(2)
    expect(d.confidence).toBe(0.93)
  })

  it('falls back to camelCase variant fields when snake_case is absent', async () => {
    const camelResponse = {
      warehouseId: 'WH-IE10-MAIN',
      totalStockLines: 10,
      unrestrictedLines: 10,
      holdLines: 0,
      qualityInspectionLines: 0,
      openGoodsReceipts: 0,
      openGoodsIssues: 0,
      openTransfers: 0,
      capacityUtilizationPercent: 50,
      activeReplenishmentNeeds: 0,
    }
    vi.stubGlobal('fetch', mockFetch(200, camelResponse))
    const result = await adapter.getWarehouse360Summary(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.warehouseId).toBe('WH-IE10-MAIN')
    expect(result.data.totalStockLines).toBe(10)
  })

  it('falls back to mock when warehouseId is empty/falsy', async () => {
    const result = await adapter.getWarehouse360Summary(emptyRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // Mock adapter doesn't set source
    expect(result.source).toBeUndefined()
    expect(vi.mocked(global.fetch)).not.toHaveBeenCalled()
  })

  it('returns ok:false with code=unauthorized on 401', async () => {
    vi.stubGlobal('fetch', mockFetch(401, {}, false))
    const result = await adapter.getWarehouse360Summary(fullRequest)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('unauthorized')
    expect(result.displayState).toBe('unauthorized')
    expect(result.source).toBe('legacy-api')
    expect(result.error.retryable).toBe(false)
  })

  it('returns ok:false with code=not-found on 404', async () => {
    vi.stubGlobal('fetch', mockFetch(404, {}, false))
    const result = await adapter.getWarehouse360Summary(fullRequest)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('not-found')
    expect(result.displayState).toBe('error')
  })

  it('returns ok:false with retryable=true on 500', async () => {
    vi.stubGlobal('fetch', mockFetch(500, {}, false))
    const result = await adapter.getWarehouse360Summary(fullRequest)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.retryable).toBe(true)
    expect(result.source).toBe('legacy-api')
  })

  it('returns ok:false on network failure, retryable=true', async () => {
    vi.stubGlobal('fetch', mockFetchError('Failed to connect'))
    const result = await adapter.getWarehouse360Summary(fullRequest)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('unknown')
    expect(result.error.retryable).toBe(true)
    expect(result.source).toBe('legacy-api')
  })

  it('includes fetchedAt ISO timestamp on success', async () => {
    const result = await adapter.getWarehouse360Summary(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('sends warehouse_id and plant_id in the request body', async () => {
    await adapter.getWarehouse360Summary(fullRequest)
    const fetchMock = vi.mocked(global.fetch)
    const [url, opts] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/api/wh360/warehouse-summary')
    const body = JSON.parse(opts?.body as string)
    expect(body.warehouse_id).toBe('WH-IE10-MAIN')
    expect(body.plant_id).toBe('IE10')
  })

  it('defaults confidence to 0.9 when absent from V1 response', async () => {
    const noConfidence = { ...V1_WAREHOUSE_SUMMARY_OK }
    delete (noConfidence as Record<string, unknown>).confidence
    vi.stubGlobal('fetch', mockFetch(200, noConfidence))
    const result = await adapter.getWarehouse360Summary(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.confidence).toBe(0.9)
  })
})
