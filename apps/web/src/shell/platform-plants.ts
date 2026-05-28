import { useQuery } from '@tanstack/react-query'
import {
  PlatformPlantsResponseSchema,
  type PlatformPlant,
  type PlatformPlantsResponse,
} from '@connectio/data-contracts'

const PLANTS_STALE_MS = 5 * 60 * 1000

/**
 * Fetch the cross-workspace plant directory from /api/platform/plants.
 *
 * Unity Catalog enforces per-user plant visibility, so the response carries
 * only the plants the authenticated user is entitled to see. The hook is
 * intentionally minimal — it returns the raw `AdapterResult`-style discriminated
 * shape so the shell can render error/empty states without bespoke parsing.
 */
export interface UsePlantsResult {
  readonly plants: readonly PlatformPlant[]
  readonly isLoading: boolean
  readonly error: string | null
}

async function fetchPlatformPlants(): Promise<PlatformPlantsResponse> {
  const response = await fetch('/api/platform/plants', {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`Plants endpoint returned HTTP ${response.status}`)
  }
  const json = await response.json()
  const parsed = PlatformPlantsResponseSchema.safeParse(json)
  if (!parsed.success) {
    throw new Error('Plants response did not match the expected contract')
  }
  return parsed.data
}

export function usePlants(): UsePlantsResult {
  const query = useQuery<PlatformPlantsResponse, Error>({
    queryKey: ['platform', 'plants'],
    queryFn: fetchPlatformPlants,
    staleTime: PLANTS_STALE_MS,
    retry: 1,
  })

  return {
    plants: query.data?.plants ?? [],
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
  }
}
