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
 * SPC Monitoring Databricks API Adapter.
 * 
 * @remarks
 * Currently blocked/pending gold-view alignment.
 * All methods return unavailable/not-found status as native Databricks
 * routes for SPC do not yet exist.
 */
export class SPCMonitoringDatabricksApiAdapter extends SPCMonitoringAdapter {
  private unavailable<T>(): AdapterResult<T> {
    return {
      ok: false,
      error: {
        code: 'not-found',
        message: 'SPC Databricks adapter unavailable — required SPC gold views are not deployed.',
        retryable: false
      },
      displayState: 'error',
      source: 'databricks-api'
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
