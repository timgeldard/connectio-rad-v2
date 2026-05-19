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
  SPCRelatedBatch
} from '@connectio/data-contracts'
import type { SPCMonitoringAdapterRequest } from './spc-monitoring-adapter.js'

/**
 * SPC Monitoring Legacy API Adapter.
 * 
 * @remarks
 * Currently a placeholder as no legacy V1 API exists for SPC.
 * All methods fall back to the base mock implementation but mark
 * the source as 'legacy-api' (simulated).
 */
export class SPCMonitoringLegacyApiAdapter extends SPCMonitoringAdapter {
  private unavailable<T>(): AdapterResult<T> {
    return {
      ok: false,
      error: {
        code: 'not-found',
        message: 'SPC Legacy API adapter unavailable — no legacy V1 API exists for SPC.',
        retryable: false
      },
      displayState: 'error',
      source: 'legacy-api'
    }
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

  override async getControlChartSeries(_request: SPCMonitoringAdapterRequest): Promise<AdapterResult<ControlChartSeries>> {
    return this.unavailable()
  }

  override async getCharacteristicCapability(_request: SPCMonitoringAdapterRequest): Promise<AdapterResult<CharacteristicCapability>> {
    return this.unavailable()
  }

  override async getSPCAlarmHistory(_request: SPCMonitoringAdapterRequest): Promise<AdapterResult<SPCAlarmHistoryItem[]>> {
    return this.unavailable()
  }

  override async getSPCRelatedBatches(_request: SPCMonitoringAdapterRequest): Promise<AdapterResult<SPCRelatedBatch[]>> {
    return this.unavailable()
  }
}
