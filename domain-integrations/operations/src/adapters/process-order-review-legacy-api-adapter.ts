import type { ProcessOrderHeader } from '@connectio/data-contracts'
import type { AdapterResult } from '@connectio/source-adapters'
import { ProcessOrderReviewAdapter } from './process-order-review-adapter.js'
import type { ProcessOrderReviewAdapterRequest } from './process-order-review-adapter.js'

/**
 * ProcessOrderReview adapter that proxies to the V1 backend for verified endpoints.
 * All other methods fall back to mock via super.
 */
export class ProcessOrderReviewLegacyApiAdapter extends ProcessOrderReviewAdapter {
  private readonly baseUrl: string

  constructor(baseUrl: string) {
    super()
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  override async getProcessOrderHeader(
    request: ProcessOrderReviewAdapterRequest,
  ): Promise<AdapterResult<ProcessOrderHeader>> {
    if (!request.processOrderId) {
      return super.getProcessOrderHeader(request)
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/por/order-header`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ process_order_id: request.processOrderId, plant_id: request.plantId }),
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

      const raw = await response.json()

      const mapped: ProcessOrderHeader = {
        processOrderId: raw.process_order_id ?? raw.processOrderId ?? request.processOrderId,
        orderType: raw.order_type ?? raw.orderType ?? 'process-order',
        materialId: raw.material_id ?? raw.materialId ?? '',
        materialDescription: raw.material_description ?? raw.materialDescription ?? '',
        batchId: raw.batch_id ?? raw.batchId,
        plantId: raw.plant_id ?? raw.plantId ?? request.plantId ?? '',
        plannedQuantity: raw.planned_qty ?? raw.planned_quantity ?? raw.plannedQuantity ?? 0,
        confirmedQuantity: raw.confirmed_qty ?? raw.confirmed_quantity ?? raw.confirmedQuantity ?? 0,
        uom: raw.uom ?? raw.base_uom ?? '',
        plannedStart: raw.planned_start ?? raw.plannedStart ?? new Date().toISOString(),
        plannedFinish: raw.planned_finish ?? raw.plannedFinish ?? new Date().toISOString(),
        actualStart: raw.actual_start ?? raw.actualStart,
        actualFinish: raw.actual_finish ?? raw.actualFinish,
        orderStatus: raw.order_status ?? raw.orderStatus ?? 'released',
      }

      return { ok: true, data: mapped, fetchedAt: new Date().toISOString(), source: 'legacy-api' }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return {
        ok: false,
        error: { code: 'unknown', message, retryable: true },
        displayState: 'error',
        source: 'legacy-api',
      }
    }
  }
}
