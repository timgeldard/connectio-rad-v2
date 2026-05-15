import type {
  EnvMonContext,
  EnvMonSiteSummary,
  EnvMonZone,
  EnvMonAlert,
  EnvMonSwabResult,
  EnvMonTrend,
  EnvMonHeatmapCell,
  EnvMonCorrectiveAction,
  EnvMonSwabVector,
} from '@connectio/data-contracts'
import type { AdapterResult, AdapterError } from '@connectio/source-adapters'
import {
  mockEnvMonContext,
  mockEnvMonSiteSummary,
  mockEnvMonZones,
  mockEnvMonAlerts,
  mockEnvMonSwabResults,
  mockEnvMonTrends,
  mockEnvMonHeatmap,
  mockEnvMonCorrectiveActions,
  mockEnvMonSwabVectors,
} from './envmon-mock-data.js'

export interface EnvMonAdapterRequest {
  readonly regionId?: string
  readonly plantId?: string
  readonly periodStart?: string
  readonly periodEnd?: string
}

export type NowFn = () => string

const defaultNow: NowFn = () => new Date().toISOString()

function ok<T>(data: T, now: NowFn = defaultNow): AdapterResult<T> {
  return { ok: true, data, fetchedAt: now() }
}

function err<T>(code: AdapterError['code'], message: string, retryable = false): AdapterResult<T> {
  return { ok: false, error: { code, message, retryable }, displayState: 'error' }
}

export interface EnvMonAdapterOptions {
  readonly now?: NowFn
}

export class EnvMonAdapter {
  private readonly now: NowFn

  constructor(options: EnvMonAdapterOptions = {}) {
    this.now = options.now ?? defaultNow
  }

  async getEnvMonContext(
    _request: EnvMonAdapterRequest
  ): Promise<AdapterResult<EnvMonContext>> {
    return ok(mockEnvMonContext, this.now)
  }

  async getEnvMonSiteSummary(
    _request: EnvMonAdapterRequest
  ): Promise<AdapterResult<EnvMonSiteSummary>> {
    return ok(mockEnvMonSiteSummary, this.now)
  }

  async getEnvMonZones(
    _request: EnvMonAdapterRequest
  ): Promise<AdapterResult<EnvMonZone[]>> {
    return ok(mockEnvMonZones, this.now)
  }

  async getEnvMonAlerts(
    _request: EnvMonAdapterRequest
  ): Promise<AdapterResult<EnvMonAlert[]>> {
    return ok(mockEnvMonAlerts, this.now)
  }

  async getEnvMonSwabResults(
    _request: EnvMonAdapterRequest
  ): Promise<AdapterResult<EnvMonSwabResult[]>> {
    return ok(mockEnvMonSwabResults, this.now)
  }

  async getEnvMonTrends(
    _request: EnvMonAdapterRequest
  ): Promise<AdapterResult<EnvMonTrend[]>> {
    return ok(mockEnvMonTrends, this.now)
  }

  async getEnvMonHeatmap(
    _request: EnvMonAdapterRequest
  ): Promise<AdapterResult<EnvMonHeatmapCell[]>> {
    return ok(mockEnvMonHeatmap, this.now)
  }

  async getEnvMonCorrectiveActions(
    _request: EnvMonAdapterRequest
  ): Promise<AdapterResult<EnvMonCorrectiveAction[]>> {
    return ok(mockEnvMonCorrectiveActions, this.now)
  }

  async getEnvMonSwabVectors(
    _request: EnvMonAdapterRequest
  ): Promise<AdapterResult<EnvMonSwabVector[]>> {
    return ok(mockEnvMonSwabVectors, this.now)
  }
}

export const envmonAdapter = new EnvMonAdapter()

export function toEnvMonAdapterError<T>(thrown: unknown): AdapterResult<T> {
  const message = thrown instanceof Error ? thrown.message : 'Unknown error'
  return err<T>('unknown', message, true)
}
