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
        // UOM is null (source-truthful) — the subgroups slice 1 response has
        // no UOM column, and the contract was relaxed in PR 8 to allow null.
        expect(result.data.unitOfMeasure).toBeNull()
        // Point status stays 'not-evaluated' — never collapsed to 'in-control'.
        expect(result.data.points[0].status).toBe('not-evaluated')
      }
    })

    it('emits null unitOfMeasure (source-truthful) rather than an empty-string sentinel', async () => {
      // PR 8 changed the contract from `z.string()` to
      // `z.string().nullable().optional()`. The adapter now emits null
      // instead of '' so the UI can render an explicit "source units"
      // indicator. This test pins that behaviour.
      const mockSubgroupResponse = {
        materialId: 'MAT1',
        plantId: 'P1',
        micId: 'MIC1',
        micName: null,
        operationId: 'OP1',
        points: [
          {
            batchId: 'B1',
            batchDate: '2024-05-22T12:00:00Z',
            subgroupMean: 10.5,
            subgroupRange: null,
            sampleCount: 1,
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
      })
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.unitOfMeasure).toBeNull()
        // Must NOT default to invented units.
        expect(result.data.unitOfMeasure).not.toBe('KG')
        expect(result.data.unitOfMeasure).not.toBe('')
      }
    })

    it('point status remains not-evaluated for every subgroup point (no in-control collapse)', async () => {
      const mockSubgroupResponse = {
        materialId: 'MAT1',
        plantId: 'P1',
        micId: 'MIC1',
        micName: null,
        operationId: 'OP1',
        points: [
          {
            batchId: 'B1',
            batchDate: '2024-05-22T12:00:00Z',
            subgroupMean: 10.0,
            subgroupRange: null,
            sampleCount: 5,
            lslSpec: null,
            uslSpec: null,
          },
          {
            batchId: 'B2',
            batchDate: '2024-05-23T12:00:00Z',
            subgroupMean: 10.2,
            subgroupRange: null,
            sampleCount: 5,
            lslSpec: null,
            uslSpec: null,
          },
          {
            batchId: 'B3',
            batchDate: '2024-05-24T12:00:00Z',
            subgroupMean: 9.9,
            subgroupRange: null,
            sampleCount: 5,
            lslSpec: null,
            uslSpec: null,
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
      })
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.points).toHaveLength(3)
        for (const point of result.data.points) {
          expect(point.status).toBe('not-evaluated')
          // Point MUST NOT be auto-promoted to 'in-control' or
          // 'out-of-control' — those decisions require a governed signal source.
          expect(point.status).not.toBe('in-control')
          expect(point.status).not.toBe('out-of-control')
          expect(point.status).not.toBe('warning')
          // signalIds stay empty until the client-side calculation engine
          // populates them.
          expect(point.signalIds).toEqual([])
        }
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
        // The error message must surface the schema field that failed so
        // operators can diagnose route-shape drift without attaching a
        // debugger.
        expect(result.error.message).toMatch(/SPCSubgroupResponse schema violation at "/)
      }
    })

    it('surfaces the specific Zod issue path when one expected field is missing', async () => {
      // Valid except missing the `points` array — exercise the path
      // reporting in the schema-violation message.
      const almostValid = {
        materialId: 'MAT1',
        plantId: 'P1',
        micId: 'MIC1',
        micName: 'Test MIC',
        operationId: 'OP1',
        // points: missing on purpose
        lockedLimits: null,
        capabilityAvailable: false,
        nelsonStoredFlagsAvailable: false,
        signalsClientSideOnly: true,
      }

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(almostValid),
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
        expect(result.error.message).toContain('"points"')
      }
    })

    it('emits a stable pointId composed from batchId + batchDate', async () => {
      const mockSubgroupResponse = {
        materialId: 'MAT1',
        plantId: 'P1',
        micId: 'MIC1',
        micName: 'Test MIC',
        operationId: 'OP1',
        points: [
          {
            batchId: 'B-001',
            batchDate: '2024-05-22T12:00:00Z',
            subgroupMean: 10.5,
            subgroupRange: 1.2,
            sampleCount: 5,
            lslSpec: null,
            uslSpec: null,
          },
          {
            batchId: 'B-002',
            batchDate: '2024-05-23T12:00:00Z',
            subgroupMean: 10.7,
            subgroupRange: 1.1,
            sampleCount: 5,
            lslSpec: null,
            uslSpec: null,
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
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.points[0].pointId).toBe('B-001::2024-05-22T12:00:00Z')
        expect(result.data.points[1].pointId).toBe('B-002::2024-05-23T12:00:00Z')
        // IDs must be unique even if batches happen to share a date.
        expect(result.data.points[0].pointId).not.toBe(result.data.points[1].pointId)
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

  describe('guardrail pinning', () => {
    const _successResponse = {
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
          subgroupRange: null,
          sampleCount: 1,
          lslSpec: null,
          uslSpec: null,
        },
      ],
      lockedLimits: null,
      capabilityAvailable: false,
      nelsonStoredFlagsAvailable: false,
      signalsClientSideOnly: true,
    }

    it('limitProvenance is always unknown — limits are derived client-side, not from a server source', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(_successResponse),
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
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.limitProvenance).toBe('unknown')
        // Must NOT claim limits came from a governed source.
        expect(result.data.limitProvenance).not.toBe('calculated')
        expect(result.data.limitProvenance).not.toBe('approved')
      }
    })

    it('lockedLimits server value is never propagated — adapter always emits false (Slice 2 deferred)', async () => {
      // The backend schema carries lockedLimits but the locked-limits join is
      // deferred to Slice 2. The adapter MUST emit false regardless of what the
      // server provides — the value must not be treated as an approval signal.
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(_successResponse),
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
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.lockedLimits).toBe(false)
      }
    })

    it('approvalState is always not-approved — no approval workflow exists for subgroups', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(_successResponse),
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
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.approvalState).toBe('not-approved')
        // Must NOT indicate pending or approved state without a governed workflow.
        expect(result.data.approvalState).not.toBe('approved')
        expect(result.data.approvalState).not.toBe('pending-validation')
      }
    })
  })
})
