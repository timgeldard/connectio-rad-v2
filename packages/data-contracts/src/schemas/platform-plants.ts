import { z } from 'zod'

/**
 * A plant available to the current user, as published by the platform plants endpoint.
 *
 * Source of truth: `${TRACE_CATALOG}.gold.gold_plant` filtered by
 * `UPPER(PLANT_NAME) NOT LIKE '%DNU%'` and ordered by `PLANT_ID`. Unity Catalog
 * enforces per-user plant visibility — the endpoint returns only the rows the
 * authenticated user is entitled to see.
 */
export const PlatformPlantSchema = z.object({
  plantId: z.string(),
  plantName: z.string(),
})

export type PlatformPlant = z.infer<typeof PlatformPlantSchema>

export const PlatformPlantsResponseSchema = z.object({
  plants: z.array(PlatformPlantSchema),
})

export type PlatformPlantsResponse = z.infer<typeof PlatformPlantsResponseSchema>
