/**
 * React Query hooks over the EnvMon V2 adapter.
 *
 * Conventions:
 * - Reads return the AdapterResult<T> shape directly so the UI can render
 *   loading/error/empty trifectas without unwrapping.
 * - Mutations invalidate every related query key on success so the Admin
 *   view's edits propagate to Site/Floor without bespoke wiring.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  EnvMonCoordinateUpsertRequest,
  EnvMonFloorUpsertRequest,
  EnvMonFloorsResponse,
  EnvMonLocationsResponse,
  EnvMonLotDetailResponse,
  EnvMonLotsResponse,
  EnvMonMicsResponse,
  EnvMonSiteSummaryV2,
  EnvMonSubAreaUpsertRequest,
  EnvMonSubAreasResponse,
  EnvMonTrendResponse,
  EnvMonUnmappedLocationsResponse,
} from '@connectio/data-contracts'
import type { AdapterResult } from '@connectio/source-adapters'
import * as adapter from './envmon-v2-adapter.js'

const STALE_MS = 60 * 1000

export function useSiteSummaryV2(plantId: string | undefined, timeWindowDays = 30) {
  return useQuery<AdapterResult<EnvMonSiteSummaryV2>>({
    queryKey: ['envmon-v2', 'site-summary', plantId, timeWindowDays],
    queryFn: () => adapter.getSiteSummary(plantId ?? '', timeWindowDays),
    enabled: Boolean(plantId),
    staleTime: STALE_MS,
  })
}

export function useFloors(plantId: string | undefined) {
  return useQuery<AdapterResult<EnvMonFloorsResponse>>({
    queryKey: ['envmon-v2', 'floors', plantId],
    queryFn: () => adapter.getFloors(plantId ?? ''),
    enabled: Boolean(plantId),
    staleTime: STALE_MS,
  })
}

export function useSubAreas(plantId: string | undefined, floorId?: string) {
  return useQuery<AdapterResult<EnvMonSubAreasResponse>>({
    queryKey: ['envmon-v2', 'sub-areas', plantId, floorId ?? null],
    queryFn: () => adapter.getSubAreas(plantId ?? '', floorId),
    enabled: Boolean(plantId),
    staleTime: STALE_MS,
  })
}

export function useLocationsV2(plantId: string | undefined, floorId?: string, timeWindowDays = 90) {
  return useQuery<AdapterResult<EnvMonLocationsResponse>>({
    queryKey: ['envmon-v2', 'locations', plantId, floorId ?? null, timeWindowDays],
    queryFn: () => adapter.getLocations(plantId ?? '', floorId, timeWindowDays),
    enabled: Boolean(plantId),
    staleTime: STALE_MS,
  })
}

export function useUnmappedLocations(plantId: string | undefined, timeWindowDays = 180) {
  return useQuery<AdapterResult<EnvMonUnmappedLocationsResponse>>({
    queryKey: ['envmon-v2', 'unmapped', plantId, timeWindowDays],
    queryFn: () => adapter.getUnmappedLocations(plantId ?? '', timeWindowDays),
    enabled: Boolean(plantId),
    staleTime: STALE_MS,
  })
}

export function useLotsV2(funcLocId: string | undefined, timeWindowDays = 90) {
  return useQuery<AdapterResult<EnvMonLotsResponse>>({
    queryKey: ['envmon-v2', 'lots', funcLocId, timeWindowDays],
    queryFn: () => adapter.getLots(funcLocId ?? '', timeWindowDays),
    enabled: Boolean(funcLocId),
    staleTime: STALE_MS,
  })
}

export function useLotDetail(lotId: string | undefined) {
  return useQuery<AdapterResult<EnvMonLotDetailResponse>>({
    queryKey: ['envmon-v2', 'lot-detail', lotId],
    queryFn: () => adapter.getLotDetail(lotId ?? ''),
    enabled: Boolean(lotId),
    staleTime: STALE_MS,
  })
}

export function useTrendsV2(
  funcLocId: string | undefined,
  micName: string | undefined,
  windowDays = 90,
) {
  return useQuery<AdapterResult<EnvMonTrendResponse>>({
    queryKey: ['envmon-v2', 'trends', funcLocId, micName, windowDays],
    queryFn: () => adapter.getTrends(funcLocId ?? '', micName ?? '', windowDays),
    enabled: Boolean(funcLocId && micName),
    staleTime: STALE_MS,
  })
}

export function useMicsV2(funcLocId?: string, plantId?: string, windowDays = 180) {
  return useQuery<AdapterResult<EnvMonMicsResponse>>({
    queryKey: ['envmon-v2', 'mics', funcLocId ?? null, plantId ?? null, windowDays],
    queryFn: () => adapter.getMics(funcLocId, plantId, windowDays),
    enabled: Boolean(funcLocId || plantId),
    staleTime: STALE_MS,
  })
}

// ─── Mutations ──────────────────────────────────────────────────────────────

function useEnvMonInvalidator() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['envmon-v2'] })
}

export function useUpsertFloor() {
  const invalidate = useEnvMonInvalidator()
  return useMutation({
    mutationFn: (req: EnvMonFloorUpsertRequest) => adapter.upsertFloor(req),
    onSuccess: invalidate,
  })
}

export function useUpsertSubArea() {
  const invalidate = useEnvMonInvalidator()
  return useMutation({
    mutationFn: (req: EnvMonSubAreaUpsertRequest) => adapter.upsertSubArea(req),
    onSuccess: invalidate,
  })
}

export function useDeleteSubArea() {
  const invalidate = useEnvMonInvalidator()
  return useMutation({
    mutationFn: (areaId: string) => adapter.deleteSubArea(areaId),
    onSuccess: invalidate,
  })
}

export function useUpsertCoordinate() {
  const invalidate = useEnvMonInvalidator()
  return useMutation({
    mutationFn: (req: EnvMonCoordinateUpsertRequest) => adapter.upsertCoordinate(req),
    onSuccess: invalidate,
  })
}

export function useDeleteCoordinate() {
  const invalidate = useEnvMonInvalidator()
  return useMutation({
    mutationFn: (funcLocId: string) => adapter.deleteCoordinate(funcLocId),
    onSuccess: invalidate,
  })
}

export function useUploadFloorSvg() {
  const invalidate = useEnvMonInvalidator()
  return useMutation({
    mutationFn: ({ plantId, floorId, file }: { plantId: string; floorId: string; file: Blob }) =>
      adapter.uploadFloorSvg(plantId, floorId, file),
    onSuccess: invalidate,
  })
}

export const floorSvgUrl = adapter.floorSvgUrl
