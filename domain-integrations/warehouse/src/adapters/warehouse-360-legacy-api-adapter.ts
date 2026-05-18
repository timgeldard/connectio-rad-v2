import type {
  Warehouse360Summary,
  Warehouse360Overview,
  Warehouse360InboundItem,
  Warehouse360OutboundItem,
  Warehouse360StagingItem,
  Warehouse360ExceptionItem,
} from '@connectio/data-contracts'
import type { AdapterResult } from '@connectio/source-adapters'
import { Warehouse360Adapter } from './warehouse-360-adapter.js'
import type { Warehouse360AdapterRequest } from './warehouse-360-adapter.js'

/**
 * Tier: legacy-api / databricks-api
 * Verified methods: none yet — awaiting browser-verification in UAT
 * Falls back to mock on any error in legacy modes, but executes native databricks-api
 * directly for cockpit views with absolute transparency.
 */
export class Warehouse360LegacyApiAdapter extends Warehouse360Adapter {
  private readonly baseUrl: string

  constructor(baseUrl: string) {
    super()
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  /**
   * Tier: legacy-api — wired to V1 WH360 warehouse-summary endpoint, not yet browser-verified.
   * Falls back to mock on any error until verified.
   */
  override async getWarehouse360Summary(
    request: Warehouse360AdapterRequest,
  ): Promise<AdapterResult<Warehouse360Summary>> {
    if (!request.warehouseId) {
      return super.getWarehouse360Summary(request)
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/wh360/warehouse-summary`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ warehouse_id: request.warehouseId, plant_id: request.plantId }),
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

      const mapped: Warehouse360Summary = {
        warehouseId: raw.warehouse_id ?? raw.warehouseId ?? request.warehouseId,
        totalStockLines: raw.total_stock_lines ?? raw.totalStockLines ?? 0,
        unrestrictedLines: raw.unrestricted_lines ?? raw.unrestrictedLines ?? 0,
        holdLines: raw.hold_lines ?? raw.holdLines ?? 0,
        qualityInspectionLines: raw.qi_lines ?? raw.qualityInspectionLines ?? 0,
        openGoodsReceipts: raw.open_gr ?? raw.openGoodsReceipts ?? 0,
        openGoodsIssues: raw.open_gi ?? raw.openGoodsIssues ?? 0,
        openTransfers: raw.open_transfers ?? raw.openTransfers ?? 0,
        capacityUtilizationPercent: raw.capacity_pct ?? raw.capacityUtilizationPercent ?? 0,
        activeReplenishmentNeeds: raw.replenishment_needs ?? raw.activeReplenishmentNeeds ?? 0,
        confidence: raw.confidence ?? 0.9,
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
   * Tier: databricks-api — GET /api/warehouse360/overview
   */
  override async getWarehouseOverview(
    request: Warehouse360AdapterRequest,
  ): Promise<AdapterResult<Warehouse360Overview>> {
    if (!request.warehouseId) {
      return super.getWarehouseOverview(request)
    }

    try {
      const url = new URL(`${this.baseUrl}/api/warehouse360/overview`)
      url.searchParams.set('warehouse_id', request.warehouseId)

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

      const raw = await response.json()
      const mapped: Warehouse360Overview = {
        plantId: String(raw.plantId ?? ''),
        warehouseId: String(raw.warehouseId ?? request.warehouseId),
        inboundDueCount: Number(raw.inboundDueCount ?? 0),
        inboundOverdueCount: Number(raw.inboundOverdueCount ?? 0),
        outboundDueCount: Number(raw.outboundDueCount ?? 0),
        outboundOverdueCount: Number(raw.outboundOverdueCount ?? 0),
        stagingOpenCount: Number(raw.stagingOpenCount ?? 0),
        stagingOverdueCount: Number(raw.stagingOverdueCount ?? 0),
        nearExpiryCount: Number(raw.nearExpiryCount ?? 0),
        reconciliationExceptionCount: Number(raw.reconciliationExceptionCount ?? 0),
        blockedStockCount: Number(raw.blockedStockCount ?? 0),
      }

      return { ok: true, data: mapped, fetchedAt: new Date().toISOString(), source: 'databricks-api' }
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
   * Tier: databricks-api — GET /api/warehouse360/inbound
   */
  override async getWarehouseInbound(
    request: Warehouse360AdapterRequest,
  ): Promise<AdapterResult<Warehouse360InboundItem[]>> {
    if (!request.warehouseId) {
      return super.getWarehouseInbound(request)
    }

    try {
      const url = new URL(`${this.baseUrl}/api/warehouse360/inbound`)
      url.searchParams.set('warehouse_id', request.warehouseId)

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

      const raw = await response.json()
      if (!Array.isArray(raw)) {
        throw new Error('Response was not an array')
      }

      const items: Warehouse360InboundItem[] = raw.map((item: any) => ({
        documentType: item.documentType === 'PO' || item.documentType === 'STO' ? item.documentType : 'unknown',
        purchaseOrderId: String(item.purchaseOrderId ?? ''),
        stockTransportOrderId: String(item.stockTransportOrderId ?? ''),
        itemId: String(item.itemId ?? ''),
        vendorId: String(item.vendorId ?? ''),
        supplyingPlantId: String(item.supplyingPlantId ?? ''),
        materialId: String(item.materialId ?? ''),
        materialDescription: String(item.materialDescription ?? ''),
        batchId: String(item.batchId ?? ''),
        plantId: String(item.plantId ?? ''),
        storageLocation: String(item.storageLocation ?? ''),
        warehouseNumber: String(item.warehouseNumber ?? ''),
        expectedDate: String(item.expectedDate ?? ''),
        receivedDate: String(item.receivedDate ?? ''),
        quantity: Number(item.quantity ?? 0),
        unitOfMeasure: String(item.unitOfMeasure ?? ''),
        status: String(item.status ?? ''),
        exceptionReason: String(item.exceptionReason ?? ''),
      }))

      return { ok: true, data: items, fetchedAt: new Date().toISOString(), source: 'databricks-api' }
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
   * Tier: databricks-api — GET /api/warehouse360/outbound
   */
  override async getWarehouseOutbound(
    request: Warehouse360AdapterRequest,
  ): Promise<AdapterResult<Warehouse360OutboundItem[]>> {
    if (!request.warehouseId) {
      return super.getWarehouseOutbound(request)
    }

    try {
      const url = new URL(`${this.baseUrl}/api/warehouse360/outbound`)
      url.searchParams.set('warehouse_id', request.warehouseId)

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

      const raw = await response.json()
      if (!Array.isArray(raw)) {
        throw new Error('Response was not an array')
      }

      const items: Warehouse360OutboundItem[] = raw.map((item: any) => ({
        deliveryId: String(item.deliveryId ?? ''),
        deliveryItemId: String(item.deliveryItemId ?? ''),
        customerId: String(item.customerId ?? ''),
        salesOrderId: String(item.salesOrderId ?? ''),
        materialId: String(item.materialId ?? ''),
        materialDescription: String(item.materialDescription ?? ''),
        batchId: String(item.batchId ?? ''),
        plantId: String(item.plantId ?? ''),
        storageLocation: String(item.storageLocation ?? ''),
        warehouseNumber: String(item.warehouseNumber ?? ''),
        plannedGoodsIssueDate: String(item.plannedGoodsIssueDate ?? ''),
        actualGoodsIssueDate: String(item.actualGoodsIssueDate ?? ''),
        quantity: Number(item.quantity ?? 0),
        unitOfMeasure: String(item.unitOfMeasure ?? ''),
        status: String(item.status ?? ''),
        exceptionReason: String(item.exceptionReason ?? ''),
      }))

      return { ok: true, data: items, fetchedAt: new Date().toISOString(), source: 'databricks-api' }
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
   * Tier: databricks-api — GET /api/warehouse360/staging
   */
  override async getWarehouseStaging(
    request: Warehouse360AdapterRequest,
  ): Promise<AdapterResult<Warehouse360StagingItem[]>> {
    if (!request.warehouseId) {
      return super.getWarehouseStaging(request)
    }

    try {
      const url = new URL(`${this.baseUrl}/api/warehouse360/staging`)
      url.searchParams.set('warehouse_id', request.warehouseId)

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

      const raw = await response.json()
      if (!Array.isArray(raw)) {
        throw new Error('Response was not an array')
      }

      const items: Warehouse360StagingItem[] = raw.map((item: any) => ({
        processOrderId: String(item.processOrderId ?? ''),
        reservationId: String(item.reservationId ?? ''),
        reservationItemId: String(item.reservationItemId ?? ''),
        materialId: String(item.materialId ?? ''),
        materialDescription: String(item.materialDescription ?? ''),
        batchId: String(item.batchId ?? ''),
        plantId: String(item.plantId ?? ''),
        storageLocation: String(item.storageLocation ?? ''),
        warehouseNumber: String(item.warehouseNumber ?? ''),
        requirementDate: String(item.requirementDate ?? ''),
        requiredQuantity: Number(item.requiredQuantity ?? 0),
        stagedQuantity: Number(item.stagedQuantity ?? 0),
        openQuantity: Number(item.openQuantity ?? 0),
        unitOfMeasure: String(item.unitOfMeasure ?? ''),
        stagingStatus: String(item.stagingStatus ?? ''),
        exceptionReason: String(item.exceptionReason ?? ''),
      }))

      return { ok: true, data: items, fetchedAt: new Date().toISOString(), source: 'databricks-api' }
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
   * Tier: databricks-api — GET /api/warehouse360/exceptions
   */
  override async getWarehouseExceptionItems(
    request: Warehouse360AdapterRequest,
  ): Promise<AdapterResult<Warehouse360ExceptionItem[]>> {
    if (!request.warehouseId) {
      return super.getWarehouseExceptionItems(request)
    }

    try {
      const url = new URL(`${this.baseUrl}/api/warehouse360/exceptions`)
      url.searchParams.set('warehouse_id', request.warehouseId)

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

      const raw = await response.json()
      if (!Array.isArray(raw)) {
        throw new Error('Response was not an array')
      }

      const items: Warehouse360ExceptionItem[] = raw.map((item: any) => ({
        exceptionType: String(item.exceptionType ?? ''),
        severity: item.severity === 'critical' || item.severity === 'high' || item.severity === 'medium' || item.severity === 'low' ? item.severity : 'low',
        materialId: String(item.materialId ?? ''),
        batchId: String(item.batchId ?? ''),
        plantId: String(item.plantId ?? ''),
        storageLocation: String(item.storageLocation ?? ''),
        warehouseNumber: String(item.warehouseNumber ?? ''),
        quantity: Number(item.quantity ?? 0),
        unitOfMeasure: String(item.unitOfMeasure ?? ''),
        expiryDate: String(item.expiryDate ?? ''),
        daysToExpiry: Number(item.daysToExpiry ?? 0),
        documentId: String(item.documentId ?? ''),
        processOrderId: String(item.processOrderId ?? ''),
        deliveryId: String(item.deliveryId ?? ''),
        purchaseOrderId: String(item.purchaseOrderId ?? ''),
        reason: String(item.reason ?? ''),
        recommendedReviewAction: String(item.recommendedReviewAction ?? ''),
      }))

      return { ok: true, data: items, fetchedAt: new Date().toISOString(), source: 'databricks-api' }
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
