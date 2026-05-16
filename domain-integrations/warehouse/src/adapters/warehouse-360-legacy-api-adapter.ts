import type { Warehouse360Summary } from '@connectio/data-contracts'
import type { AdapterResult } from '@connectio/source-adapters'
import { Warehouse360Adapter } from './warehouse-360-adapter.js'
import type { Warehouse360AdapterRequest } from './warehouse-360-adapter.js'

/**
 * Tier: legacy-api
 * Verified methods: none yet — getWarehouse360Summary wired but not browser-verified against V1 WH360
 * Fallback: Warehouse360Adapter (mock) — all methods return mock data until verified
 * Next tier: databricks-api (pending V1 WH360 retirement)
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
}
