import type {
  Warehouse360OverviewContext,
  Warehouse360Summary,
  StockOverview,
  OpenHoldItem,
  GoodsMovementEvent,
  ReplenishmentNeed,
  LocationCapacity,
} from '@connectio/data-contracts'
import type { AdapterResult } from '@connectio/source-adapters'
import { Warehouse360Adapter } from './warehouse-360-adapter.js'
import type { Warehouse360AdapterRequest } from './warehouse-360-adapter.js'

/**
 * Warehouse360 adapter that calls the V2 proxy routes, which forward to the V1 WMS backend.
 * Falls back to mock data for any method missing required context.
 */
export class Warehouse360LegacyApiAdapter extends Warehouse360Adapter {
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

  private _wh360Body(request: Warehouse360AdapterRequest): Record<string, unknown> {
    return {
      warehouse_id: request.warehouseId,
      plant_id: request.plantId,
      storage_location_id: request.storageLocationId,
    }
  }

  override async getWarehouse360Context(
    request: Warehouse360AdapterRequest,
  ): Promise<AdapterResult<Warehouse360OverviewContext>> {
    if (!request.warehouseId) return super.getWarehouse360Context(request)
    return this._post<Warehouse360OverviewContext>('/api/wh360/context', this._wh360Body(request))
  }

  override async getWarehouse360Summary(
    request: Warehouse360AdapterRequest,
  ): Promise<AdapterResult<Warehouse360Summary>> {
    if (!request.warehouseId) return super.getWarehouse360Summary(request)

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
      return { ok: false, error: { code: 'unknown', message, retryable: true }, displayState: 'error', source: 'legacy-api' }
    }
  }

  override async getStockOverview(
    request: Warehouse360AdapterRequest,
  ): Promise<AdapterResult<StockOverview>> {
    if (!request.warehouseId) return super.getStockOverview(request)
    return this._post<StockOverview>('/api/wh360/stock-overview', this._wh360Body(request))
  }

  override async getOpenHolds(
    request: Warehouse360AdapterRequest,
  ): Promise<AdapterResult<OpenHoldItem[]>> {
    if (!request.warehouseId) return super.getOpenHolds(request)
    return this._post<OpenHoldItem[]>('/api/wh360/open-holds', this._wh360Body(request))
  }

  override async getGoodsMovements(
    request: Warehouse360AdapterRequest,
  ): Promise<AdapterResult<GoodsMovementEvent[]>> {
    if (!request.warehouseId) return super.getGoodsMovements(request)
    return this._post<GoodsMovementEvent[]>('/api/wh360/goods-movements', this._wh360Body(request))
  }

  override async getReplenishmentNeeds(
    request: Warehouse360AdapterRequest,
  ): Promise<AdapterResult<ReplenishmentNeed[]>> {
    if (!request.warehouseId) return super.getReplenishmentNeeds(request)
    return this._post<ReplenishmentNeed[]>('/api/wh360/replenishment-needs', this._wh360Body(request))
  }

  override async getLocationCapacities(
    request: Warehouse360AdapterRequest,
  ): Promise<AdapterResult<LocationCapacity[]>> {
    if (!request.warehouseId) return super.getLocationCapacities(request)
    return this._post<LocationCapacity[]>('/api/wh360/location-capacities', this._wh360Body(request))
  }
}
