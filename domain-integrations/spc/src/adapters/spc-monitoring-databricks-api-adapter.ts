import { SPCMonitoringAdapter } from './spc-monitoring-adapter.js'
import type { AdapterResult } from '@connectio/source-adapters'
import {
  type SPCMonitoringContext,
  type SPCSummary,
  type SPCSignal,
  type MonitoredSPCCharacteristic,
  type ControlChartSeries,
  type CharacteristicCapability,
  type SPCAlarmHistoryItem,
  type SPCRelatedBatch,
  type ControlChartPoint,
  SPCSubgroupResponseSchema,
} from '@connectio/data-contracts'
import type { SPCMonitoringAdapterRequest } from './spc-monitoring-adapter.js'

async function proxyGet(
  baseUrl: string,
  path: string,
  params: Record<string, string>,
): Promise<unknown> {
  const url = new URL(`${baseUrl}${path}`)
  for (const [key, val] of Object.entries(params)) {
    if (val) url.searchParams.set(key, val)
  }
  const response = await fetch(url.toString(), { method: 'GET', credentials: 'include' })
  if (!response.ok) throw { status: response.status }
  return response.json()
}

function toErrorResult<T>(
  err: unknown,
  source: 'databricks-api' = 'databricks-api',
): AdapterResult<T> {
  const status = (err as { status?: number })?.status
  const code =
    status === 401
      ? ('unauthorized' as const)
      : status === 404
        ? ('not-found' as const)
        : ('network' as const)
  return {
    ok: false,
    error: {
      code,
      message: `Proxy returned ${status ?? 'unknown'}`,
      retryable: (status ?? 0) >= 500,
    },
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

  private unavailable<T>(
    message: string = 'SPC Databricks adapter unavailable — required SPC gold views are not deployed.',
  ): AdapterResult<T> {
    return {
      ok: false,
      error: {
        code: 'not-found',
        message,
        retryable: false,
      },
      displayState: 'error',
      source: 'databricks-api',
    }
  }

  override async getControlChartSeries(
    request: SPCMonitoringAdapterRequest,
  ): Promise<AdapterResult<ControlChartSeries>> {
    if (!request.materialId || !request.characteristicId || !request.plantId) {
      return this.unavailable('Missing required identifiers (material, plant, or characteristic).')
    }

    if (!request.operationId || request.operationId.trim() === '') {
      return this.unavailable(
        'Native Databricks route requires operationId. workCentreId cannot be used as a substitute.',
      )
    }

    if (!request.dateFrom || !request.dateTo) {
      return this.unavailable('Native Databricks route requires dateFrom and dateTo filters.')
    }

    try {
      const params: Record<string, string> = {
        material_id: request.materialId,
        plant_id: request.plantId,
        mic_id: request.characteristicId,
        operation_id: request.operationId,
        date_from: request.dateFrom,
        date_to: request.dateTo,
      }

      if (request.limit !== undefined) {
        params['limit'] = request.limit.toString()
      }

      const raw = await proxyGet(this.baseUrl, '/api/spc/subgroups', params)

      const parsed = SPCSubgroupResponseSchema.safeParse(raw)
      if (!parsed.success) {
        // Surface the first Zod issue so debugging doesn't require attaching
        // a debugger — the route shape is contract-policed and any drift
        // here is a real defect the operator needs to see.
        const firstIssue = parsed.error.issues[0]
        const issuePath = firstIssue?.path.join('.') ?? '(unknown)'
        const issueMessage = firstIssue?.message ?? 'unknown validation error'
        return {
          ok: false,
          error: {
            code: 'invalid-data',
            message: `SPCSubgroupResponse schema violation at "${issuePath}": ${issueMessage}`,
            retryable: false,
          },
          displayState: 'error',
          source: 'databricks-api',
        }
      }
      const data = parsed.data

      const points: ControlChartPoint[] = data.points.map((p) => ({
        // pointId is composed from the source batch + date so consumers can
        // build stable references without depending on array index ordering.
        pointId: `${p.batchId}::${p.batchDate}`,
        timestamp: p.batchDate,
        value: p.subgroupMean,
        batchId: p.batchId,
        sampleId: undefined, // Not provided by subgroups view (slice 1).
        signalIds: [], // Source-truthful: no governed signal engine exists.
        // 'not-evaluated' is the source-truthful default added in PR #82.
        // The UI MUST NOT collapse this into 'in-control'.
        status: 'not-evaluated' as const,
      }))

      // Pick specs from first point (they are identical per batch if not changed)
      const firstPoint = data.points[0]
      const lsl = firstPoint?.lslSpec ?? undefined
      const usl = firstPoint?.uslSpec ?? undefined
      const sampleCount = firstPoint?.sampleCount ?? 1

      // Derive chartType safely
      let resolvedChartType: ControlChartSeries['chartType'] = 'individuals'
      if (request.chartType === 'xbar-r' || request.chartType === 'individuals') {
        resolvedChartType = request.chartType
      } else if (sampleCount > 1) {
        resolvedChartType = 'xbar-r'
      }

      const series: ControlChartSeries = {
        chartId: `${request.materialId}-${request.characteristicId}`,
        chartType: resolvedChartType,
        characteristicId: data.micId ?? request.characteristicId,
        characteristicName: data.micName ?? request.characteristicId,
        points,
        centerLine: undefined, // Client-side calculation handles this.
        upperControlLimit: undefined,
        lowerControlLimit: undefined,
        upperSpecLimit: usl,
        lowerSpecLimit: lsl,
        // gold_batch_quality_result_v exposes UNIT_OF_MEASURE but the
        // /api/spc/subgroups slice 1 response does NOT include it. Empty
        // string is the contract's only allowed sentinel today (the schema
        // is `z.string()` non-optional). The UI MUST render "source units"
        // / blank when this is empty — it MUST NOT invent a value.
        // Tracked: relax ControlChartSeriesSchema.unitOfMeasure to nullable
        // alongside a UOM-bearing subgroup-response slice.
        unitOfMeasure: '',
        // No control-limit calculation source — limits are derived by the
        // client-side calculation engine.
        limitProvenance: 'unknown',
        approvalState: 'not-approved',
        lockedLimits: false, // Locked-limits join deferred to Slice 2.
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

  override async getCharacteristicCapability(
    _request: SPCMonitoringAdapterRequest,
  ): Promise<AdapterResult<CharacteristicCapability>> {
    // Deliberately hardcoding unavailable to comply with guardrails
    return this.unavailable()
  }

  override async getSPCMonitoringContext(
    _request: SPCMonitoringAdapterRequest,
  ): Promise<AdapterResult<SPCMonitoringContext>> {
    return this.unavailable()
  }

  override async getSPCSummary(
    _request: SPCMonitoringAdapterRequest,
  ): Promise<AdapterResult<SPCSummary>> {
    return this.unavailable()
  }

  override async getActiveSPCSignals(
    _request: SPCMonitoringAdapterRequest,
  ): Promise<AdapterResult<SPCSignal[]>> {
    return this.unavailable()
  }

  override async getMonitoredCharacteristics(
    _request: SPCMonitoringAdapterRequest,
  ): Promise<AdapterResult<MonitoredSPCCharacteristic[]>> {
    return this.unavailable()
  }

  override async getSPCAlarmHistory(
    _request: SPCMonitoringAdapterRequest,
  ): Promise<AdapterResult<SPCAlarmHistoryItem[]>> {
    return this.unavailable()
  }

  override async getSPCRelatedBatches(
    _request: SPCMonitoringAdapterRequest,
  ): Promise<AdapterResult<SPCRelatedBatch[]>> {
    return this.unavailable()
  }
}
