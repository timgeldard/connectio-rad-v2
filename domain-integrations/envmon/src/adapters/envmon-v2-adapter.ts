/**
 * EnvMon V2 adapter — calls into /api/envmon/v2/* and the cross-workspace
 * /api/platform/plants endpoint. Databricks-api only; no mock branches.
 *
 * Every method validates against the matching Zod schema in
 * `@connectio/data-contracts`. Errors surface as `AdapterResult.ok = false`
 * with a typed `AdapterError.code` so the UI can render error/empty states.
 */
import {
  EnvMonCoordinateUpsertRequestSchema,
  EnvMonFloorUpsertRequestSchema,
  EnvMonFloorsResponseSchema,
  EnvMonHeatmapResponseSchema,
  EnvMonLocationsResponseSchema,
  EnvMonLotDetailResponseSchema,
  EnvMonLotsResponseSchema,
  EnvMonMicsResponseSchema,
  EnvMonSiteSummaryV2Schema,
  EnvMonSubAreaUpsertRequestSchema,
  EnvMonSubAreasResponseSchema,
  EnvMonTrendResponseSchema,
  EnvMonUnmappedLocationsResponseSchema,
  type EnvMonCoordinateUpsertRequest,
  type EnvMonFloorUpsertRequest,
  type EnvMonFloorsResponse,
  type EnvMonHeatmapResponse,
  type EnvMonLocationsResponse,
  type EnvMonLotDetailResponse,
  type EnvMonLotsResponse,
  type EnvMonMicsResponse,
  type EnvMonSiteSummaryV2,
  type EnvMonSubAreaUpsertRequest,
  type EnvMonSubAreasResponse,
  type EnvMonTrendResponse,
  type EnvMonUnmappedLocationsResponse,
} from '@connectio/data-contracts'
import type { AdapterError, AdapterResult, AdapterWriteResult } from '@connectio/source-adapters'

type AnyZodSchema<T> = { safeParse(data: unknown): { success: true; data: T } | { success: false; error: { issues: { path: (string | number)[]; message: string }[] } } }

const NOW = () => new Date().toISOString()

function httpStatusToCode(status: number): AdapterError['code'] {
  if (status === 401 || status === 403) return 'unauthorized'
  if (status === 404) return 'not-found'
  if (status === 504) return 'timeout'
  if (status >= 500 || status === 429) return 'network'
  if (status === 422 || status === 400) return 'invalid-data'
  return 'unknown'
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504
}

async function fetchJsonValidated<T>(
  url: string,
  schema: AnyZodSchema<T>,
  init?: RequestInit,
): Promise<AdapterResult<T>> {
  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
    })
  } catch (e) {
    return {
      ok: false,
      error: {
        code: 'network',
        message: e instanceof Error ? e.message : 'Network failure',
        retryable: true,
      },
      displayState: 'error',
      source: 'databricks-api',
    }
  }
  if (!response.ok) {
    let detail = response.statusText
    try {
      const body = await response.json()
      if (typeof body?.detail === 'string') detail = body.detail
    } catch {
      // fall through
    }
    return {
      ok: false,
      error: {
        code: httpStatusToCode(response.status),
        message: detail || `HTTP ${response.status}`,
        retryable: isRetryableStatus(response.status),
      },
      displayState: 'error',
      source: 'databricks-api',
    }
  }
  const json = await response.json()
  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    const path = first?.path?.join('.') ?? ''
    const msg = first ? `[${path}] ${first.message}` : 'shape mismatch'
    return {
      ok: false,
      error: {
        code: 'invalid-data',
        message: `Response did not match the expected contract: ${msg}`,
        retryable: false,
      },
      displayState: 'error',
      source: 'databricks-api',
    }
  }
  return { ok: true, data: parsed.data, fetchedAt: NOW(), source: 'databricks-api' }
}

async function fetchWriteValidated(
  url: string,
  init: RequestInit,
): Promise<AdapterWriteResult> {
  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    })
  } catch (e) {
    return {
      ok: false,
      error: {
        code: 'network',
        message: e instanceof Error ? e.message : 'Network failure',
        retryable: true,
      },
      source: 'databricks-api',
    }
  }
  if (!response.ok) {
    let detail = response.statusText
    try {
      const body = await response.json()
      if (typeof body?.detail === 'string') detail = body.detail
    } catch {
      // fall through
    }
    return {
      ok: false,
      error: {
        code: httpStatusToCode(response.status),
        message: detail || `HTTP ${response.status}`,
        retryable: isRetryableStatus(response.status),
      },
      source: 'databricks-api',
    }
  }
  const json = await response.json().catch(() => ({}))
  return {
    ok: true,
    affectedRows: typeof json.affectedRows === 'number' ? json.affectedRows : undefined,
    updatedAt: NOW(),
    source: 'databricks-api',
  }
}

// ─── Reads ──────────────────────────────────────────────────────────────────

export function getSiteSummary(plantId: string, timeWindowDays = 30) {
  const url = `/api/envmon/v2/site-summary?plant_id=${encodeURIComponent(plantId)}&time_window_days=${timeWindowDays}`
  return fetchJsonValidated<EnvMonSiteSummaryV2>(url, EnvMonSiteSummaryV2Schema)
}

export function getFloors(plantId: string) {
  const url = `/api/envmon/v2/floors?plant_id=${encodeURIComponent(plantId)}`
  return fetchJsonValidated<EnvMonFloorsResponse>(url, EnvMonFloorsResponseSchema)
}

export function getSubAreas(plantId: string, floorId?: string) {
  const qs = floorId
    ? `?plant_id=${encodeURIComponent(plantId)}&floor_id=${encodeURIComponent(floorId)}`
    : `?plant_id=${encodeURIComponent(plantId)}`
  return fetchJsonValidated<EnvMonSubAreasResponse>(
    `/api/envmon/v2/sub-areas${qs}`,
    EnvMonSubAreasResponseSchema,
  )
}

export function getLocations(plantId: string, floorId?: string, timeWindowDays = 90) {
  const qs = new URLSearchParams({ plant_id: plantId, time_window_days: String(timeWindowDays) })
  if (floorId) qs.set('floor_id', floorId)
  return fetchJsonValidated<EnvMonLocationsResponse>(
    `/api/envmon/v2/locations?${qs.toString()}`,
    EnvMonLocationsResponseSchema,
  )
}

export function getUnmappedLocations(plantId: string, timeWindowDays = 180) {
  const qs = new URLSearchParams({ plant_id: plantId, time_window_days: String(timeWindowDays) })
  return fetchJsonValidated<EnvMonUnmappedLocationsResponse>(
    `/api/envmon/v2/locations/unmapped?${qs.toString()}`,
    EnvMonUnmappedLocationsResponseSchema,
  )
}

export function getLots(funcLocId: string, timeWindowDays = 90) {
  const qs = new URLSearchParams({ func_loc_id: funcLocId, time_window_days: String(timeWindowDays) })
  return fetchJsonValidated<EnvMonLotsResponse>(
    `/api/envmon/v2/lots?${qs.toString()}`,
    EnvMonLotsResponseSchema,
  )
}

export function getLotDetail(lotId: string) {
  return fetchJsonValidated<EnvMonLotDetailResponse>(
    `/api/envmon/v2/lots/${encodeURIComponent(lotId)}`,
    EnvMonLotDetailResponseSchema,
  )
}

export function getTrends(funcLocId: string, micName: string, windowDays = 90) {
  const qs = new URLSearchParams({
    func_loc_id: funcLocId,
    mic_name: micName,
    window_days: String(windowDays),
  })
  return fetchJsonValidated<EnvMonTrendResponse>(
    `/api/envmon/v2/trends?${qs.toString()}`,
    EnvMonTrendResponseSchema,
  )
}

export function getMics(funcLocId?: string, plantId?: string, windowDays = 180) {
  const qs = new URLSearchParams({ window_days: String(windowDays) })
  if (funcLocId) qs.set('func_loc_id', funcLocId)
  if (plantId) qs.set('plant_id', plantId)
  return fetchJsonValidated<EnvMonMicsResponse>(
    `/api/envmon/v2/mics?${qs.toString()}`,
    EnvMonMicsResponseSchema,
  )
}

export function getHeatmapStub(): EnvMonHeatmapResponse {
  // Heatmap derives from locations; stub kept for future server-side
  // /heatmap endpoint when continuous-mode lambda calculation moves to SQL.
  return EnvMonHeatmapResponseSchema.parse({
    plantId: '',
    floorId: '',
    mode: 'deterministic',
    markers: [],
  })
}

export function floorSvgUrl(plantId: string, floorId: string): string {
  return `/api/envmon/v2/floors/${encodeURIComponent(plantId)}/${encodeURIComponent(floorId)}/svg`
}

// ─── Writes ─────────────────────────────────────────────────────────────────

export function upsertFloor(req: EnvMonFloorUpsertRequest) {
  EnvMonFloorUpsertRequestSchema.parse(req)
  return fetchWriteValidated('/api/envmon/v2/floors', {
    method: 'POST',
    body: JSON.stringify(req),
  })
}

export function upsertSubArea(req: EnvMonSubAreaUpsertRequest) {
  EnvMonSubAreaUpsertRequestSchema.parse(req)
  return fetchWriteValidated('/api/envmon/v2/sub-areas', {
    method: 'POST',
    body: JSON.stringify(req),
  })
}

export function deleteSubArea(areaId: string) {
  return fetchWriteValidated(`/api/envmon/v2/sub-areas/${encodeURIComponent(areaId)}`, {
    method: 'DELETE',
  })
}

export function upsertCoordinate(req: EnvMonCoordinateUpsertRequest) {
  EnvMonCoordinateUpsertRequestSchema.parse(req)
  return fetchWriteValidated('/api/envmon/v2/coordinates', {
    method: 'POST',
    body: JSON.stringify(req),
  })
}

export function deleteCoordinate(funcLocId: string) {
  return fetchWriteValidated(`/api/envmon/v2/coordinates/${encodeURIComponent(funcLocId)}`, {
    method: 'DELETE',
  })
}

export function uploadFloorSvg(plantId: string, floorId: string, file: Blob): Promise<AdapterWriteResult> {
  const url = `/api/envmon/v2/floors/${encodeURIComponent(plantId)}/${encodeURIComponent(floorId)}/svg`
  const form = new FormData()
  form.append('svg', file, `${floorId}.svg`)
  return fetchWriteValidated(url, {
    method: 'POST',
    body: form,
    // Let the browser set the multipart boundary header.
    headers: {},
  })
}
