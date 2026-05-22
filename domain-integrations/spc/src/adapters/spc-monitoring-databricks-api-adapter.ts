import { SPCMonitoringAdapter } from './spc-monitoring-adapter.js'
import type { AdapterResult } from '@connectio/source-adapters'
import type { 
  SPCMonitoringContext, 
  SPCSummary, 
  SPCSignal,
  MonitoredSPCCharacteristic,
  ControlChartSeries,
  CharacteristicCapability,
  SPCAlarmHistoryItem,
  SPCRelatedBatch,
  SPCSubgroupResponse,
  ControlChartPoint
} from '@connectio/data-contracts'
import type { SPCMonitoringAdapterRequest } from './spc-monitoring-adapter.js'

async function proxyGet(baseUrl: string, path: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(`${baseUrl}${path}`)
  for (const [key, val] of Object.entries(params)) {
    if (val) url.searchParams.set(key, val)
  }
  const response = await fetch(url.toString(), { method: 'GET', credentials: 'include' })
  if (!response.ok) throw { status: response.status }
  return response.json()
}

function toErrorResult<T>(err: unknown, source: 'databricks-api' = 'databricks-api'): AdapterResult<T> {
  const status = (err as { status?: number })?.status
  const code =
    status === 401 ? ('unauthorized' as const)
      : status === 404 ? ('not-found' as const)
        : ('network' as const)
  return {
    ok: false,
    error: { code, message: `Proxy returned ${status ?? 'unknown'}`, retryable: (status ?? 0) >= 500 },
    displayState: code === 'unauthorized' ? 'unauthorized' : 'error',
    source,
  }
}

/**
 * SPC Monitoring Databricks API Adapter.
 * 
 * @remarks
 * Implements the native Databricks route `GET /api/spc/subgroups` to fetch subgroup data.
 * Adheres strictly to guardrails:
 * - capability calculation/flags (Cp/Cpk/Pp/Ppk) are hardcoded unavailable.
 * - stored Nelson flags and process control statuses are explicitly excluded.
 * - does not claim production readiness.
 */
export class SPCMonitoringDatabricksApiAdapter extends SPCMonitoringAdapter {
  private readonly baseUrl: string

  constructor(baseUrl: string = 'http://127.0.0.1:8000') {
    super()
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  private unavailable<T>(): AdapterResult<T> {
    return {
      ok: false,
      error: {
        code: 'not-found',
        message: 'SPC Databricks adapter unavailable — required SPC gold views are not deployed.',
        retryable: false
      },
      displayState: 'error',
      source: 'databricks-api'
    }
  }

  override async getControlChartSeries(
    request: SPCMonitoringAdapterRequest
  ): Promise<AdapterResult<ControlChartSeries>> {
    if (!request.materialId || !request.characteristicId || !request.plantId) {
      return this.unavailable()
    }

    try {
      const params: Record<string, string> = {
        material_id: request.materialId,
        plant_id: request.plantId,
        mic_id: request.characteristicId,
      }
      
      // Map operationId if present (never workCentreId)
      if (request.operationId) params['operation_id'] = request.operationId

      const raw = await proxyGet(this.baseUrl, '/api/spc/subgroups', params) as SPCSubgroupResponse

      const points: ControlChartPoint[] = (raw.points || []).map((p, idx) => ({
        pointId: `pt-${idx}-${p.batchId}`,
        timestamp: p.batchDate,
        value: p.subgroupMean,
        batchId: p.batchId,
        sampleId: undefined, // Not provided by subgroups view
        signalIds: [], // Hard-coded empty, signals are calculated client-side
        status: 'not-evaluated' as const // Deliberately avoiding 'in-control' claim
      }))

      // Pick specs from first point (they are identical per batch if not changed)
      const firstPoint = raw.points?.[0]
      const lsl = firstPoint?.lslSpec ?? undefined
      const usl = firstPoint?.uslSpec ?? undefined

      const series: ControlChartSeries = {
        chartId: `${request.materialId}-${request.characteristicId}`,
        chartType: 'individuals', // Using individuals as default/placeholder for subgroup mean plotting
        characteristicId: raw.micId ?? request.characteristicId,
        characteristicName: raw.micName ?? request.characteristicId,
        points,
        centerLine: undefined, // Client-side calculation handles this
        upperControlLimit: undefined,
        lowerControlLimit: undefined,
        upperSpecLimit: usl,
        lowerSpecLimit: lsl,
        unitOfMeasure: '', // Not provided by subgroup response yet
        limitProvenance: 'calculated-from-sample', // Limits will be computed from sample data client-side
        approvalState: 'not-approved',
        lockedLimits: false, // Locked limits deferred to Slice 2
        confidence: 1.0,
      }

      return {
        ok: true,
        data: series,
        fetchedAt: new Date().toISOString(),
        source: 'databricks-api',
      }
    } catch (err) {
      return toErrorResult(err)
    }
  }

  override async getCharacteristicCapability(_request: SPCMonitoringAdapterRequest): Promise<AdapterResult<CharacteristicCapability>> {
    // Deliberately hardcoding unavailable to comply with guardrails
    return this.unavailable()
  }

  override async getSPCMonitoringContext(_request: SPCMonitoringAdapterRequest): Promise<AdapterResult<SPCMonitoringContext>> {
    return this.unavailable()
  }

  override async getSPCSummary(_request: SPCMonitoringAdapterRequest): Promise<AdapterResult<SPCSummary>> {
    return this.unavailable()
  }

  override async getActiveSPCSignals(_request: SPCMonitoringAdapterRequest): Promise<AdapterResult<SPCSignal[]>> {
    return this.unavailable()
  }

  override async getMonitoredCharacteristics(_request: SPCMonitoringAdapterRequest): Promise<AdapterResult<MonitoredSPCCharacteristic[]>> {
    return this.unavailable()
  }

  override async getSPCAlarmHistory(_request: SPCMonitoringAdapterRequest): Promise<AdapterResult<SPCAlarmHistoryItem[]>> {
    return this.unavailable()
  }

  override async getSPCRelatedBatches(_request: SPCMonitoringAdapterRequest): Promise<AdapterResult<SPCRelatedBatch[]>> {
    return this.unavailable()
  }
}
