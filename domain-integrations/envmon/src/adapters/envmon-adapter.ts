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
import { EnvMonSiteSummarySchema as SiteSummarySchema } from '@connectio/data-contracts'
import type { AdapterResult, AdapterError } from '@connectio/source-adapters'
import { z } from 'zod'
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
  readonly limit?: number
}

export type EnvMonNativeSwabStatus = 'fail' | 'warning' | 'pending' | 'pass'

export const EnvMonNativeSwabResultSchema = z.object({
  inspectionLotId: z.string().nullable(),
  inspectionPointId: z.string().nullable(),
  sampleId: z.string().nullable(),
  operationId: z.string().nullable(),
  functionalLocation: z.string().nullable(),
  sampleSummary: z.string().nullable(),
  sampleHour: z.union([z.string(), z.number()]).nullable(),
  plantId: z.string().nullable(),
  inspectionType: z.string().nullable(),
  createdDate: z.string().nullable(),
  inspectionEndDate: z.string().nullable(),
  micId: z.string().nullable(),
  micName: z.string().nullable(),
  micCode: z.string().nullable(),
  result: z.union([z.string(), z.number()]).nullable(),
  quantitativeResult: z.number().nullable(),
  qualitativeResult: z.string().nullable(),
  targetValue: z.number().nullable(),
  upperTolerance: z.number().nullable(),
  lowerTolerance: z.number().nullable(),
  unitOfMeasure: z.string().nullable(),
  valuation: z.string().nullable(),
  status: z.enum(['fail', 'warning', 'pending', 'pass']),
  inspector: z.string().nullable(),
  inspectionMethod: z.string().nullable(),
  materialId: z.string().nullable(),
  batchId: z.string().nullable(),
  processOrderId: z.string().nullable(),
})

export type EnvMonNativeSwabResult = z.infer<typeof EnvMonNativeSwabResultSchema>

export type NowFn = () => string

const defaultNow: NowFn = () => new Date().toISOString()

function ok<T>(data: T, now: NowFn = defaultNow): AdapterResult<T> {
  return { ok: true, data, fetchedAt: now() }
}

function databricksOk<T>(data: T, now: NowFn = defaultNow): AdapterResult<T> {
  return { ok: true, data, fetchedAt: now(), source: 'databricks-api' }
}

function err<T>(code: AdapterError['code'], message: string, retryable = false): AdapterResult<T> {
  return { ok: false, error: { code, message, retryable }, displayState: 'error' }
}

function databricksErr<T>(
  code: AdapterError['code'],
  message: string,
  retryable = false,
): AdapterResult<T> {
  return { ok: false, error: { code, message, retryable }, displayState: 'error', source: 'databricks-api' }
}

export interface EnvMonAdapterOptions {
  readonly now?: NowFn
  readonly baseUrl?: string
}

export class EnvMonAdapter {
  private readonly now: NowFn
  private readonly baseUrl: string

  constructor(options: EnvMonAdapterOptions = {}) {
    this.now = options.now ?? defaultNow
    this.baseUrl = options.baseUrl ?? getDefaultApiBaseUrl()
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

  async getNativeSiteSummary(
    request: EnvMonAdapterRequest
  ): Promise<AdapterResult<EnvMonSiteSummary>> {
    const validationError = validateNativeRequest(request)
    if (validationError) return databricksErr<EnvMonSiteSummary>('invalid-data', validationError)

    try {
      const response = await fetch(`${this.baseUrl}/api/envmon/site-summary?${toNativeParams(request)}`)
      if (!response.ok) {
        return databricksErr<EnvMonSiteSummary>(
          statusToErrorCode(response.status),
          await responseToMessage(response),
          isRetryableStatus(response.status),
        )
      }
      const parsed = SiteSummarySchema.safeParse(await response.json())
      if (!parsed.success) {
        return databricksErr<EnvMonSiteSummary>('invalid-data', 'EnvMon site summary response did not match the expected contract')
      }
      return databricksOk(parsed.data, this.now)
    } catch (e) {
      return databricksErr<EnvMonSiteSummary>('network', e instanceof Error ? e.message : 'Unable to fetch EnvMon site summary', true)
    }
  }

  async getNativeSwabResults(
    request: EnvMonAdapterRequest
  ): Promise<AdapterResult<EnvMonNativeSwabResult[]>> {
    const validationError = validateNativeRequest(request)
    if (validationError) return databricksErr<EnvMonNativeSwabResult[]>('invalid-data', validationError)

    try {
      const response = await fetch(`${this.baseUrl}/api/envmon/swab-results?${toNativeParams(request)}`)
      if (!response.ok) {
        return databricksErr<EnvMonNativeSwabResult[]>(
          statusToErrorCode(response.status),
          await responseToMessage(response),
          isRetryableStatus(response.status),
        )
      }
      const parsed = z.array(EnvMonNativeSwabResultSchema).safeParse(await response.json())
      if (!parsed.success) {
        return databricksErr<EnvMonNativeSwabResult[]>('invalid-data', 'EnvMon swab results response did not match the expected contract')
      }
      return databricksOk(parsed.data, this.now)
    } catch (e) {
      return databricksErr<EnvMonNativeSwabResult[]>('network', e instanceof Error ? e.message : 'Unable to fetch EnvMon swab results', true)
    }
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

function getDefaultApiBaseUrl(): string {
  return import.meta.env.VITE_LEGACY_API_BASE_URL ?? ''
}

function validateNativeRequest(request: EnvMonAdapterRequest): string | null {
  if (!request.plantId) return 'Plant ID is required'
  if (!request.periodStart) return 'Period start is required'
  if (!request.periodEnd) return 'Period end is required'
  return null
}

function toNativeParams(request: EnvMonAdapterRequest): URLSearchParams {
  const params = new URLSearchParams({
    plant_id: request.plantId ?? '',
    period_start: request.periodStart ?? '',
    period_end: request.periodEnd ?? '',
  })
  if (request.limit !== undefined) params.set('limit', String(request.limit))
  return params
}

function statusToErrorCode(status: number): AdapterError['code'] {
  if (status === 401 || status === 403) return 'unauthorized'
  if (status === 404) return 'not-found'
  if (status === 504) return 'timeout'
  if (status >= 500 || status === 429) return 'network'
  return 'unknown'
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504
}

async function responseToMessage(response: Response): Promise<string> {
  try {
    const body = await response.json()
    if (typeof body?.detail === 'string') return body.detail
  } catch {
    // Fall through to status text.
  }
  return response.statusText || `Request failed with HTTP ${response.status}`
}
