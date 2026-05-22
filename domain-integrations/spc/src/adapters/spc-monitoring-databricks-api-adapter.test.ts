import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SPCMonitoringDatabricksApiAdapter } from './spc-monitoring-databricks-api-adapter.js'

describe('SPCMonitoringDatabricksApiAdapter', () => {
  let adapter: SPCMonitoringDatabricksApiAdapter

  beforeEach(() => {
    adapter = new SPCMonitoringDatabricksApiAdapter('http://localhost:8000')
    vi.restoreAllMocks()
  })

  describe('getControlChartSeries', () => {
    it('returns error if missing material, plant, or mic', async () => {
      const request = { materialId: 'MAT1' }
      const result = await adapter.getControlChartSeries(request)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('not-found')
      }
    })

    it('returns error if missing operationId', async () => {
      const request = {
        materialId: 'MAT1',
        plantId: 'P1',
        characteristicId: 'MIC1',
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
      }
      const result = await adapter.getControlChartSeries(request)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('not-found')
        expect(result.error.message).toContain('operationId')
      }
    })

    it('returns error if missing dateFrom or dateTo', async () => {
      const request = {
        materialId: 'MAT1',
        plantId: 'P1',
        characteristicId: 'MIC1',
        operationId: 'OP1',
        dateFrom: '2024-01-01',
      }
      const result = await adapter.getControlChartSeries(request)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('not-found')
        expect(result.error.message).toContain('dateFrom and dateTo')
      }
    })

    it('fetches subgroups with all required native filters and maps response correctly', async () => {
      const mockSubgroupResponse = {
        materialId: 'MAT1',
        plantId: 'P1',
        micId: 'MIC1',
        micName: 'Test MIC',
        operationId: 'OP1',
        points: [
          {
            batchId: 'B1',
            batchDate: '2024-05-22T12:00:00Z',
            subgroupMean: 10.5,
            subgroupRange: 1.2,
            sampleCount: 5,
            lslSpec: 9.0,
            uslSpec: 11.0,
          },
        ],
        lockedLimits: null,
        capabilityAvailable: false,
        nelsonStoredFlagsAvailable: false,
        signalsClientSideOnly: true,
      }

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSubgroupResponse),
      })
      vi.stubGlobal('fetch', fetchMock)

      const result = await adapter.getControlChartSeries({
        materialId: 'MAT1',
        plantId: 'P1',
        characteristicId: 'MIC1',
        operationId: 'OP1',
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
        limit: 100,
      })

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(
          '/api/spc/subgroups?material_id=MAT1&plant_id=P1&mic_id=MIC1&operation_id=OP1&date_from=2024-01-01&date_to=2024-01-31&limit=100',
        ),
        expect.objectContaining({ method: 'GET' }),
      )

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.source).toBe('databricks-api')
        expect(result.data.points).toHaveLength(1)
        expect(result.data.points[0].status).toBe('not-evaluated')
        expect(result.data.points[0].signalIds).toEqual([])
        expect(result.data.upperSpecLimit).toBe(11.0)
        expect(result.data.lowerSpecLimit).toBe(9.0)

        // Guardrails
        expect(result.data.centerLine).toBeUndefined()
        expect(result.data.upperControlLimit).toBeUndefined()
        expect(result.data.lowerControlLimit).toBeUndefined()
        expect(result.data.lockedLimits).toBe(false)
        expect(result.data.approvalState).toBe('not-approved')
        expect(result.data.limitProvenance).toBe('unknown')
        expect(result.data.chartType).toBe('xbar-r') // Derived from sampleCount=5
      }
    })

    it('returns error if backend response fails schema validation', async () => {
      const invalidResponse = {
        // Missing all required fields
        bad: 'data',
      }

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(invalidResponse),
      })
      vi.stubGlobal('fetch', fetchMock)

      const result = await adapter.getControlChartSeries({
        materialId: 'MAT1',
        plantId: 'P1',
        characteristicId: 'MIC1',
        operationId: 'OP1',
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('invalid-data')
      }
    })

    it('maps 401 response to unauthorized error without mock fallback', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      })
      vi.stubGlobal('fetch', fetchMock)

      const result = await adapter.getControlChartSeries({
        materialId: 'MAT1',
        plantId: 'P1',
        characteristicId: 'MIC1',
        operationId: 'OP1',
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('unauthorized')
      }
    })

    it('maps 422 response to network error without mock fallback', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
      })
      vi.stubGlobal('fetch', fetchMock)

      const result = await adapter.getControlChartSeries({
        materialId: 'MAT1',
        plantId: 'P1',
        characteristicId: 'MIC1',
        operationId: 'OP1',
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('network')
      }
    })
  })

  describe('getCharacteristicCapability', () => {
    it('returns unavailable per guardrails', async () => {
      const result = await adapter.getCharacteristicCapability({
        materialId: 'MAT1',
        plantId: 'P1',
        characteristicId: 'MIC1',
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('not-found')
        expect(result.source).toBe('databricks-api')
      }
    })
  })
})
