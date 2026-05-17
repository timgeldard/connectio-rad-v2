import type { ProcessOrderConfirmation, ProcessOrderGoodsMovement, ProcessOrderHeader, ProcessOrderOperation } from '@connectio/data-contracts'
import type { AdapterResult } from '@connectio/source-adapters'
import { ProcessOrderReviewAdapter } from './process-order-review-adapter.js'
import type { ProcessOrderReviewAdapterRequest } from './process-order-review-adapter.js'

/**
 * Tier: legacy-api / databricks-api
 * Verified methods (databricks-api, 2026-05-17): getOrderOperations, getOrderConfirmations, getOrderGoodsMovements
 * Verified methods (legacy-api): none — getProcessOrderHeader wired but not browser-verified against V1
 * Fallback: ProcessOrderReviewAdapter (mock) — unimplemented methods return mock data
 */
export class ProcessOrderReviewLegacyApiAdapter extends ProcessOrderReviewAdapter {
  private readonly baseUrl: string

  constructor(baseUrl: string) {
    super()
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  /**
   * Tier: legacy-api — wired to V1 POH order-header endpoint, not yet browser-verified.
   * Falls back to mock on any error until verified.
   */
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

  /**
   * Tier: databricks-api — wired to native Databricks GET /api/por/order-operations.
   * No V1 endpoint exists for this data. Browser-verified 2026-05-17 (PO 7006965038, 11 ops).
   *
   * Known gaps from vw_gold_process_order_phase (2026-05-17):
   *   workCentre, plannedStart, plannedFinish, plannedDurationMinutes not in view — returned empty/zero.
   *   status and confirmationStatus inferred from START_USER/END_USER presence.
   */
  override async getOrderOperations(
    request: ProcessOrderReviewAdapterRequest,
  ): Promise<AdapterResult<ProcessOrderOperation[]>> {
    if (!request.processOrderId) {
      return super.getOrderOperations(request)
    }

    try {
      const url = new URL(`${this.baseUrl}/api/por/order-operations`)
      url.searchParams.set('process_order_id', request.processOrderId)

      const response = await fetch(url.toString(), {
        method: 'GET',
        credentials: 'include',
      })

      if (!response.ok) {
        const code =
          response.status === 401
            ? ('unauthorized' as const)
            : ('network' as const)
        return {
          ok: false,
          error: { code, message: `Proxy returned ${response.status}`, retryable: response.status >= 500 },
          displayState: code === 'unauthorized' ? 'unauthorized' : 'error',
          source: 'databricks-api',
        }
      }

      const raw: unknown = await response.json()
      if (!Array.isArray(raw)) {
        return {
          ok: false,
          error: { code: 'invalid-data', message: 'Order operations response was not an array', retryable: false },
          displayState: 'error',
          source: 'databricks-api',
        }
      }

      const operations: ProcessOrderOperation[] = raw.map((item: unknown) => {
        const r = item as Record<string, unknown>
        return {
          operationId: String(r.operationId ?? ''),
          operationNumber: String(r.operationNumber ?? ''),
          operationText: String(r.operationText ?? ''),
          workCentre: String(r.workCentre ?? ''),
          plannedStart: String(r.plannedStart ?? ''),
          plannedFinish: String(r.plannedFinish ?? ''),
          plannedDurationMinutes: Number(r.plannedDurationMinutes ?? 0),
          status: (r.status as ProcessOrderOperation['status']) ?? 'pending',
          confirmationStatus: (r.confirmationStatus as ProcessOrderOperation['confirmationStatus']) ?? 'unconfirmed',
          confirmed: Boolean(r.confirmed),
          hasException: Boolean(r.hasException),
        }
      })

      return { ok: true, data: operations, fetchedAt: new Date().toISOString(), source: 'databricks-api' }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return {
        ok: false,
        error: { code: 'unknown', message, retryable: true },
        displayState: 'error',
        source: 'databricks-api',
      }
    }
  }

  /**
   * Tier: databricks-api — wired to GET /api/por/order-confirmations.
   * No V1 endpoint exists for this data. Browser-verify after deployment.
   *
   * Known gaps from vw_gold_confirmation (2026-05-17):
   *   operationText, isFinalConfirmation not in view — fields omitted from response.
   *   Duration columns returned in minutes (converted from seconds in backend mapper).
   */
  override async getOrderConfirmations(
    request: ProcessOrderReviewAdapterRequest,
  ): Promise<AdapterResult<ProcessOrderConfirmation[]>> {
    if (!request.processOrderId) {
      return super.getOrderConfirmations(request)
    }

    try {
      const url = new URL(`${this.baseUrl}/api/por/order-confirmations`)
      url.searchParams.set('process_order_id', request.processOrderId)

      const response = await fetch(url.toString(), {
        method: 'GET',
        credentials: 'include',
      })

      if (!response.ok) {
        const code = response.status === 401 ? ('unauthorized' as const) : ('network' as const)
        return {
          ok: false,
          error: { code, message: `Proxy returned ${response.status}`, retryable: response.status >= 500 },
          displayState: code === 'unauthorized' ? 'unauthorized' : 'error',
          source: 'databricks-api',
        }
      }

      const raw: unknown = await response.json()
      if (!Array.isArray(raw)) {
        return {
          ok: false,
          error: { code: 'invalid-data', message: 'Order confirmations response was not an array', retryable: false },
          displayState: 'error',
          source: 'databricks-api',
        }
      }

      const confirmations: ProcessOrderConfirmation[] = raw.map((item: unknown) => {
        const r = item as Record<string, unknown>
        return {
          confirmationId: String(r.confirmationId ?? ''),
          operationId: String(r.operationId ?? ''),
          operationText: r.operationText !== undefined ? String(r.operationText) : undefined,
          confirmedYield: Number(r.confirmedYield ?? 0),
          uom: String(r.uom ?? ''),
          confirmedAt: String(r.confirmedAt ?? ''),
          confirmedBy: r.confirmedBy !== undefined ? String(r.confirmedBy) : undefined,
          isFinalConfirmation: r.isFinalConfirmation !== undefined ? Boolean(r.isFinalConfirmation) : undefined,
          setupDurationMinutes: r.setupDurationMinutes !== undefined ? Number(r.setupDurationMinutes) : undefined,
          machineDurationMinutes: r.machineDurationMinutes !== undefined ? Number(r.machineDurationMinutes) : undefined,
          cleaningDurationMinutes: r.cleaningDurationMinutes !== undefined ? Number(r.cleaningDurationMinutes) : undefined,
          variancePercent: r.variancePercent !== undefined ? Number(r.variancePercent) : undefined,
        }
      })

      return { ok: true, data: confirmations, fetchedAt: new Date().toISOString(), source: 'databricks-api' }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return {
        ok: false,
        error: { code: 'unknown', message, retryable: true },
        displayState: 'error',
        source: 'databricks-api',
      }
    }
  }

  /**
   * Tier: databricks-api — wired to GET /api/por/order-goods-movements.
   * No V1 endpoint exists for this data. Browser-verify after deployment.
   *
   * Known gaps from vw_gold_adp_movement (2026-05-17):
   *   materialDescription not in view — field omitted from response.
   *   direction: 'unknown' for unrecognised ADP codes (711/712/999/null) — rendered visibly.
   *   Extend _MOVEMENT_DIRECTION_MAP in poh_databricks_adapter.py when direction is confirmed.
   */
  override async getOrderGoodsMovements(
    request: ProcessOrderReviewAdapterRequest,
  ): Promise<AdapterResult<ProcessOrderGoodsMovement[]>> {
    if (!request.processOrderId) {
      return super.getOrderGoodsMovements(request)
    }

    try {
      const url = new URL(`${this.baseUrl}/api/por/order-goods-movements`)
      url.searchParams.set('process_order_id', request.processOrderId)

      const response = await fetch(url.toString(), {
        method: 'GET',
        credentials: 'include',
      })

      if (!response.ok) {
        const code = response.status === 401 ? ('unauthorized' as const) : ('network' as const)
        return {
          ok: false,
          error: { code, message: `Proxy returned ${response.status}`, retryable: response.status >= 500 },
          displayState: code === 'unauthorized' ? 'unauthorized' : 'error',
          source: 'databricks-api',
        }
      }

      const raw: unknown = await response.json()
      if (!Array.isArray(raw)) {
        return {
          ok: false,
          error: { code: 'invalid-data', message: 'Order goods movements response was not an array', retryable: false },
          displayState: 'error',
          source: 'databricks-api',
        }
      }

      const movements: ProcessOrderGoodsMovement[] = raw
        .map((item: unknown) => {
          const r = item as Record<string, unknown>
          return {
            movementId: String(r.movementId ?? ''),
            movementType: String(r.movementType ?? ''),
            direction: (r.direction as 'input' | 'output' | 'unknown') ?? 'unknown',
            materialId: String(r.materialId ?? ''),
            materialDescription: r.materialDescription !== undefined ? String(r.materialDescription) : undefined,
            batchId: r.batchId !== undefined ? String(r.batchId) : undefined,
            quantity: Number(r.quantity ?? 0),
            uom: String(r.uom ?? ''),
            postedAt: String(r.postedAt ?? ''),
            postedBy: r.postedBy !== undefined ? String(r.postedBy) : undefined,
            referenceDocument: r.referenceDocument !== undefined ? String(r.referenceDocument) : undefined,
            storageLocation: r.storageLocation !== undefined ? String(r.storageLocation) : undefined,
          }
        })

      return { ok: true, data: movements, fetchedAt: new Date().toISOString(), source: 'databricks-api' }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return {
        ok: false,
        error: { code: 'unknown', message, retryable: true },
        displayState: 'error',
        source: 'databricks-api',
      }
    }
  }
}
