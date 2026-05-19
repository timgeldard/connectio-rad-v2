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
 * Currently blocked/pending catalog alignment.
 * All methods fall back to the base mock implementation but mark
 * the source as 'databricks-api' (blocked/mock).
 */
export class SPCMonitoringDatabricksApiAdapter extends SPCMonitoringAdapter {
  private wrap<T>(result: AdapterResult<T>): AdapterResult<T> {
    return { ...result, source: 'databricks-api' }
  }

  override async getSPCMonitoringContext(request: SPCMonitoringAdapterRequest): Promise<AdapterResult<SPCMonitoringContext>> {
    return this.wrap(await super.getSPCMonitoringContext(request))
  }

  override async getSPCSummary(request: SPCMonitoringAdapterRequest): Promise<AdapterResult<SPCSummary>> {
    return this.wrap(await super.getSPCSummary(request))
  }

  override async getActiveSPCSignals(request: SPCMonitoringAdapterRequest): Promise<AdapterResult<SPCSignal[]>> {
    return this.wrap(await super.getActiveSPCSignals(request))
  }

  override async getMonitoredCharacteristics(request: SPCMonitoringAdapterRequest): Promise<AdapterResult<MonitoredSPCCharacteristic[]>> {
    return this.wrap(await super.getMonitoredCharacteristics(request))
  }

  override async getControlChartSeries(request: SPCMonitoringAdapterRequest): Promise<AdapterResult<ControlChartSeries>> {
    return this.wrap(await super.getControlChartSeries(request))
  }

  override async getCharacteristicCapability(request: SPCMonitoringAdapterRequest): Promise<AdapterResult<CharacteristicCapability>> {
    return this.wrap(await super.getCharacteristicCapability(request))
  }

  override async getSPCAlarmHistory(request: SPCMonitoringAdapterRequest): Promise<AdapterResult<SPCAlarmHistoryItem[]>> {
    return this.wrap(await super.getSPCAlarmHistory(request))
  }

  override async getSPCRelatedBatches(request: SPCMonitoringAdapterRequest): Promise<AdapterResult<SPCRelatedBatch[]>> {
    return this.wrap(await super.getSPCRelatedBatches(request))
  }
}
