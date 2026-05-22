import { z } from 'zod'

/**
 * One SAP movement on the batch. Codes are MSEG movement codes:
 * 101 = production receipt, 261 = consumption to order, 601 = goods issue
 * (dispatch), 701 = stock adjustment, Z01 = company-specific extension.
 */
export const MassBalanceEventSchema = z.object({
  d: z.number().int(),
  date: z.string().nullable().optional(),
  delta: z.number(),
  cum: z.number(),
  code: z.enum(['101', '261', '601', '701', 'Z01']),
  label: z.string(),
})
export type MassBalanceEvent = z.infer<typeof MassBalanceEventSchema>

export const MassBalancePostingsSchema = z.object({
  production: z.number().int(),
  consumption: z.number().int(),
  dispatch: z.number().int(),
  adjustment: z.number().int(),
})

export const MassBalanceKpiSchema = z.object({
  produced: z.number(),
  consumed: z.number(),
  shipped: z.number(),
  adjusted: z.number(),
  current: z.number(),
  variance: z.number(),
  uom: z.string(),
  postings: MassBalancePostingsSchema,
})

/**
 * Mass-balance ledger for a batch — derived from SAP MSEG (material
 * movements). The mathematical invariant is:
 *   variance = produced + adjusted + consumed + shipped - current
 * where `consumed` and `shipped` carry their natural negative signs.
 */
export const MassBalanceLedgerSchema = z.object({
  kpi: MassBalanceKpiSchema,
  events: z.array(MassBalanceEventSchema),
  dateStart: z.string(),
  dateEnd: z.string(),
})
export type MassBalanceLedger = z.infer<typeof MassBalanceLedgerSchema>
