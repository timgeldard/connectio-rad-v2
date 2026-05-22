import { z } from 'zod'

export const RecallDeliveryStatusSchema = z.enum(['delivered', 'in-transit', 'recalled', 'blocked'])
export type RecallDeliveryStatus = z.infer<typeof RecallDeliveryStatusSchema>

export const RecallDeliverySchema = z.object({
  id: z.string(),
  customer: z.string(),
  country: z.string(),
  date: z.string(),
  qty: z.number(),
  status: RecallDeliveryStatusSchema,
  doc: z.string(),
})
export type RecallDelivery = z.infer<typeof RecallDeliverySchema>

export const RecallCountrySchema = z.object({
  code: z.string(),
  name: z.string(),
  qty: z.number(),
  pct: z.number(),
})
export type RecallCountry = z.infer<typeof RecallCountrySchema>

export const RecallTotalsSchema = z.object({
  customers: z.number().int(),
  countries: z.number().int(),
  deliveries: z.number().int(),
  shipped: z.number(),
  uom: z.string(),
})
export type RecallTotals = z.infer<typeof RecallTotalsSchema>

/**
 * Recall readiness for a batch — cross-plant exposure with delivery-level
 * detail and per-country aggregates. The active plant context is NEVER used
 * to filter this query — a shipment may originate at plant A but the
 * material may also be received and used at plant B.
 */
export const RecallReadinessSchema = z.object({
  totals: RecallTotalsSchema,
  countries: z.array(RecallCountrySchema),
  deliveries: z.array(RecallDeliverySchema),
  recallRecommended: z.boolean().nullable().optional(),
})
export type RecallReadiness = z.infer<typeof RecallReadinessSchema>
