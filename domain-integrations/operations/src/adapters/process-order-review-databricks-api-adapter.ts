import type { ProcessOrderConfirmation, ProcessOrderGoodsMovement, ProcessOrderOperation } from '@connectio/data-contracts'
import type { AdapterResult } from '@connectio/source-adapters'
import { ProcessOrderReviewLegacyApiAdapter } from './process-order-review-legacy-api-adapter.js'
import type { ProcessOrderReviewAdapterRequest } from './process-order-review-adapter.js'

/**
 * Tier: databricks-api
 * Native Databricks methods verified (2026-05-17): getOrderOperations, getOrderConfirmations, getOrderGoodsMovements
 * Inherits getProcessOrderHeader from LegacyApiAdapter (which proxies to V1).
 */
export class ProcessOrderReviewDatabricksApiAdapter extends ProcessOrderReviewLegacyApiAdapter {
  /**
   * Tier: databricks-api — wired to native Databricks GET /api/por/order-operations.
   * No V1 endpoint exists for this data. Browser-verified 2026-05-17 (PO 7006965038, 11 ops).
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
          plannedStart: r.plannedStart ? String(r.plannedStart) : undefined,
          plannedFinish: r.plannedFinish ? String(r.plannedFinish) : undefined,
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
   * No V1 endpoint exists for this data.
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
          confirmedAt: r.confirmedAt ? String(r.confirmedAt) : undefined,
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
   * No V1 endpoint exists for this data.
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
            direction:
              r.direction === 'input' || r.direction === 'output' || r.direction === 'unknown'
                ? r.direction
                : 'unknown',
            materialId: String(r.materialId ?? ''),
            materialDescription: r.materialDescription !== undefined ? String(r.materialDescription) : undefined,
            batchId: r.batchId !== undefined ? String(r.batchId) : undefined,
            quantity: Number(r.quantity ?? 0),
            uom: String(r.uom ?? ''),
            postedAt: r.postedAt ? String(r.postedAt) : undefined,
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
