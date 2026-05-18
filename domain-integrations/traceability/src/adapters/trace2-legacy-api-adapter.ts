import { BatchHeaderSummarySchema, ApiError } from '@connectio/data-contracts'
import type { BatchHeaderSummary, TraceGraph } from '@connectio/data-contracts'
import type { AdapterResult } from '@connectio/source-adapters'
import { Trace2Adapter } from './trace2-adapter.js'
import type { Trace2AdapterRequest } from './trace2-adapter.js'
import { mapBackendTraceGraph } from './trace2-graph-mapper.js'

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
 * Tier: legacy-api (HTTP calls to FastAPI backend)
 * getBatchHeaderSummary: proxies to V1 Trace2 (browser-verified)
 * getTraceGraph: calls native Databricks route POST /api/trace2/trace-graph (browser-verified 2026-05-18)
 * All other methods: fall through to Trace2Adapter mock
 */
export class Trace2LegacyApiAdapter extends Trace2Adapter {
  private readonly baseUrl: string

  constructor(baseUrl: string) {
    super()
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  /**
   * Tier: legacy-api — browser-verified against V1 Trace2 batch-header endpoint.
   * Next tier: databricks-api (pending V1 Trace2 retirement).
   */
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

  /**
   * Tier: databricks-api — calls native POST /api/trace2/trace-graph (browser-verified 2026-05-18).
   * No mock fallback. No legacy-api fallback. Returns error if required params are missing.
   */
  override async getTraceGraph(request: Trace2AdapterRequest): Promise<AdapterResult<TraceGraph>> {
    if (!request.batchId || !request.materialId || !request.plantId) {
      return {
        ok: false,
        error: {
          code: 'not-found',
          message: 'material_id, batch_id, and plant_id are required for trace graph',
          retryable: false,
        },
        displayState: 'error',
        source: 'databricks-api',
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/trace2/trace-graph`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          material_id: request.materialId,
          batch_id: request.batchId,
          plant_id: request.plantId,
          direction: 'both',
          max_depth: 6,
          max_edges: 1000,
        }),
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
          error: {
            code,
            message: `Trace graph request failed: ${response.status}`,
            retryable: response.status >= 500,
          },
          displayState: code === 'unauthorized' ? 'unauthorized' : 'error',
          source: 'databricks-api',
        }
      }

      const raw = await response.json()
      const mapped = mapBackendTraceGraph(raw)
      return { ok: true, data: mapped, fetchedAt: new Date().toISOString(), source: 'databricks-api' }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      const code = message.includes('parse') || message.includes('schema') ? 'invalid-data' as const : 'unknown' as const
      return {
        ok: false,
        error: { code, message, retryable: code === 'unknown' },
        displayState: 'error',
        source: 'databricks-api',
      }
    }
  }
}
