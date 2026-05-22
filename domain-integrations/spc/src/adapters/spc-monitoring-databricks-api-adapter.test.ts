import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SPCMonitoringDatabricksApiAdapter } from './spc-monitoring-databricks-api-adapter.js'

describe('SPCMonitoringDatabricksApiAdapter', () => {
  let adapter: SPCMonitoringDatabricksApiAdapter

  beforeEach(() => {
    adapter = new SPCMonitoringDatabricksApiAdapter('http://localhost:8000')
    vi.restoreAllMocks()
  })

  describe('getControlChartSeries', () => {
    it('returns error if required params are missing', async () => {
      const request = { materialId: 'MAT1' } // missing plantId and characteristicId
      const result = await adapter.getControlChartSeries(request)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('not-found')
      }
    })

    it('fetches subgroups from native databricks route and applies guardrails', async () => {
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
          }
        ],
        lockedLimits: null,
        capabilityAvailable: false,
        nelsonStoredFlagsAvailable: false,
        signalsClientSideOnly: true
      }

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSubgroupResponse)
      })
      vi.stubGlobal('fetch', fetchMock)

      const result = await adapter.getControlChartSeries({
        materialId: 'MAT1',
        plantId: 'P1',
        characteristicId: 'MIC1',
        operationId: 'OP1'
      })

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/spc/subgroups?material_id=MAT1&plant_id=P1&mic_id=MIC1&operation_id=OP1'),
        expect.objectContaining({ method: 'GET' })
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
      }
    })
  })

  describe('getCharacteristicCapability', () => {
    it('returns unavailable per guardrails', async () => {
      const result = await adapter.getCharacteristicCapability({
        materialId: 'MAT1',
        plantId: 'P1',
        characteristicId: 'MIC1'
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('not-found')
        expect(result.source).toBe('databricks-api')
      }
    })
  })
})
