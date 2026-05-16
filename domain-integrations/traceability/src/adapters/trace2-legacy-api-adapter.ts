import { BatchHeaderSummarySchema, ApiError } from '@connectio/data-contracts'
import type {
  BatchHeaderSummary,
  TraceInvestigationContext,
  TraceGraph,
  MassBalanceSummary,
  CustomerExposureSummary,
  SupplierExposureSummary,
  TraceEvent,
  CoAReleaseStatus,
  TraceRiskSignal,
  RelatedInvestigation,
  TraceExposureForRelease,
} from '@connectio/data-contracts'
import type { AdapterResult } from '@connectio/source-adapters'
import { Trace2Adapter } from './trace2-adapter.js'
import type { Trace2AdapterRequest } from './trace2-adapter.js'

interface V1BatchHeaderResponse {
  material_id: string
  batch_id: string
  material_name: string
  process_order: string | null
  plant_id: string
  manufacture_date: string | null
  expiry_date: string | null
  uom: string
  qty_produced: number
  unrestricted: number
  blocked: number
  qi: number
  restricted: number
  transit: number
  batch_status: string
  [key: string]: unknown
}

function toIsoDatetime(dateStr: string | null | undefined): string | undefined {
  if (!dateStr) return undefined
  return dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00.000Z`
}

function mapBatchStatus(status: string): 'active' | 'archived' | 'blocked' | 'deleted' {
  const s = status.toLowerCase()
  if (s === 'blocked' || s === '2') return 'blocked'
  if (s === 'archived' || s === '3') return 'archived'
  if (s === 'deleted' || s === '4') return 'deleted'
  return 'active'
}

function mapStockStatus(r: V1BatchHeaderResponse): BatchHeaderSummary['stockStatus'] {
  if (r.blocked > 0) return 'blocked'
  if (r.qi > 0) return 'quality-inspection'
  if (r.transit > 0) return 'transit'
  if (r.restricted > 0) return 'returns'
  return 'unrestricted'
}

function mapQualityStatus(r: V1BatchHeaderResponse): BatchHeaderSummary['qualityStatus'] {
  if (r.qi > 0) return 'pending'
  if (r.blocked > 0) return 'rejected'
  return 'not-applicable'
}

function mapReleaseStatus(r: V1BatchHeaderResponse): BatchHeaderSummary['releaseStatus'] {
  if (r.blocked > 0) return 'blocked'
  if (r.qi > 0) return 'not-released'
  if (r.unrestricted > 0) return 'released'
  return 'unknown'
}

/**
 * Trace2 adapter that calls the V2 proxy routes, which forward to the V1 FastAPI backend.
 * Falls back to mock data for any method missing required context.
 */
export class Trace2LegacyApiAdapter extends Trace2Adapter {
  private readonly baseUrl: string

  constructor(baseUrl: string) {
    super()
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  private async _post<T>(path: string, body: Record<string, unknown>): Promise<AdapterResult<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const code =
          response.status === 401
            ? ('unauthorized' as const)
            : response.status === 404
              ? ('not-found' as const)
              : ('network' as const)
        return {
          ok: false,
          error: { code, message: `Proxy returned ${response.status}`, retryable: response.status >= 500 },
          displayState: code === 'unauthorized' ? 'unauthorized' : 'error',
          source: 'legacy-api',
        }
      }

      const data = (await response.json()) as T
      return { ok: true, data, fetchedAt: new Date().toISOString(), source: 'legacy-api' }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return { ok: false, error: { code: 'unknown', message, retryable: true }, displayState: 'error', source: 'legacy-api' }
    }
  }

  private _traceBody(request: Trace2AdapterRequest): Record<string, unknown> {
    return {
      investigation_id: request.investigationId,
      batch_id: request.batchId,
      material_id: request.materialId,
      plant_id: request.plantId,
    }
  }

  override async getBatchHeaderSummary(
    request: Trace2AdapterRequest,
  ): Promise<AdapterResult<BatchHeaderSummary>> {
    if (!request.batchId || !request.materialId) {
      return super.getBatchHeaderSummary(request)
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/trace2/batch-header`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ material_id: request.materialId, batch_id: request.batchId }),
      })

      if (!response.ok) {
        const code =
          response.status === 401
            ? ('unauthorized' as const)
            : response.status === 404
              ? ('not-found' as const)
              : ('network' as const)
        return {
          ok: false,
          error: { code, message: `Proxy returned ${response.status}`, retryable: response.status >= 500 },
          displayState: code === 'unauthorized' ? 'unauthorized' : 'error',
          source: 'legacy-api',
        }
      }

      const raw = (await response.json()) as V1BatchHeaderResponse

      const mapped = BatchHeaderSummarySchema.parse({
        materialId: raw.material_id,
        materialDescription: raw.material_name,
        batchId: raw.batch_id,
        plantId: raw.plant_id,
        plantName: raw.plant_id,
        batchStatus: mapBatchStatus(raw.batch_status),
        quantity: raw.qty_produced,
        uom: raw.uom,
        manufactureDate: toIsoDatetime(raw.manufacture_date),
        expiryDate: toIsoDatetime(raw.expiry_date),
        processOrderId: raw.process_order ?? undefined,
        stockStatus: mapStockStatus(raw),
        qualityStatus: mapQualityStatus(raw),
        releaseStatus: mapReleaseStatus(raw),
      })

      return { ok: true, data: mapped, fetchedAt: new Date().toISOString(), source: 'legacy-api' }
    } catch (e) {
      if (e instanceof ApiError) {
        const code: 'unauthorized' | 'not-found' | 'network' =
          e.status === 401 ? 'unauthorized' : e.status === 404 ? 'not-found' : 'network'
        return {
          ok: false,
          error: { code, message: e.message, retryable: e.status >= 500 },
          displayState: code === 'unauthorized' ? 'unauthorized' : 'error',
          source: 'legacy-api',
        }
      }
      const message = e instanceof Error ? e.message : String(e)
      return {
        ok: false,
        error: { code: 'unknown', message, retryable: true },
        displayState: 'error',
        source: 'legacy-api',
      }
    }
  }

  override async getInvestigationContext(
    request: Trace2AdapterRequest,
  ): Promise<AdapterResult<TraceInvestigationContext>> {
    if (!request.batchId || !request.materialId) return super.getInvestigationContext(request)
    return this._post<TraceInvestigationContext>('/api/trace2/investigation-context', this._traceBody(request))
  }

  override async getTraceGraph(
    request: Trace2AdapterRequest,
  ): Promise<AdapterResult<TraceGraph>> {
    if (!request.batchId || !request.materialId) return super.getTraceGraph(request)
    return this._post<TraceGraph>('/api/trace2/trace-graph', this._traceBody(request))
  }

  override async getMassBalanceSummary(
    request: Trace2AdapterRequest,
  ): Promise<AdapterResult<MassBalanceSummary>> {
    if (!request.batchId || !request.materialId) return super.getMassBalanceSummary(request)
    return this._post<MassBalanceSummary>('/api/trace2/mass-balance', this._traceBody(request))
  }

  override async getCustomerExposureSummary(
    request: Trace2AdapterRequest,
  ): Promise<AdapterResult<CustomerExposureSummary>> {
    if (!request.batchId || !request.materialId) return super.getCustomerExposureSummary(request)
    return this._post<CustomerExposureSummary>('/api/trace2/customer-exposure', this._traceBody(request))
  }

  override async getSupplierExposureSummary(
    request: Trace2AdapterRequest,
  ): Promise<AdapterResult<SupplierExposureSummary>> {
    if (!request.batchId || !request.materialId) return super.getSupplierExposureSummary(request)
    return this._post<SupplierExposureSummary>('/api/trace2/supplier-exposure', this._traceBody(request))
  }

  override async getEventTimeline(
    request: Trace2AdapterRequest,
  ): Promise<AdapterResult<readonly TraceEvent[]>> {
    if (!request.batchId || !request.materialId) return super.getEventTimeline(request)
    return this._post<readonly TraceEvent[]>('/api/trace2/event-timeline', this._traceBody(request))
  }

  override async getCoAReleaseStatus(
    request: Trace2AdapterRequest,
  ): Promise<AdapterResult<CoAReleaseStatus>> {
    if (!request.batchId || !request.materialId) return super.getCoAReleaseStatus(request)
    return this._post<CoAReleaseStatus>('/api/trace2/coa-release', this._traceBody(request))
  }

  override async getRiskSignals(
    request: Trace2AdapterRequest,
  ): Promise<AdapterResult<readonly TraceRiskSignal[]>> {
    if (!request.batchId || !request.materialId) return super.getRiskSignals(request)
    return this._post<readonly TraceRiskSignal[]>('/api/trace2/risk-signals', this._traceBody(request))
  }

  override async getRelatedInvestigations(
    request: Trace2AdapterRequest,
  ): Promise<AdapterResult<readonly RelatedInvestigation[]>> {
    if (!request.batchId || !request.materialId) return super.getRelatedInvestigations(request)
    return this._post<readonly RelatedInvestigation[]>('/api/trace2/related-investigations', this._traceBody(request))
  }

  override async getTraceExposureForRelease(
    request: Trace2AdapterRequest,
  ): Promise<AdapterResult<TraceExposureForRelease>> {
    if (!request.batchId || !request.materialId) return super.getTraceExposureForRelease(request)
    return this._post<TraceExposureForRelease>('/api/trace2/trace-exposure', this._traceBody(request))
  }
}
