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
 *
 * Caveats — surface these in the UI; DO NOT claim "reconciled" without
 * caveat:
 *   1. `MOVEMENT_CATEGORY` direction semantics are unresolved in the
 *      traceability mass-balance audit. The bucketing in this schema is
 *      derived from MOVEMENT_TYPE codes only.
 *   2. `BALANCE_QTY` from gold_batch_mass_balance_v is used as the
 *      running on-hand. Its derivation rules are NOT yet documented; the
 *      panel must not treat it as governed truth.
 *   3. Movement-type codes outside the known {101/102/131, 261/262,
 *      601/602, 701/702/711/712} sets fall into the `Z01` bucket and
 *      will not contribute to KPI rollups — flag this in tests when
 *      observed.
 */
export const MassBalanceLedgerSchema = z.object({
  kpi: MassBalanceKpiSchema,
  events: z.array(MassBalanceEventSchema),
  dateStart: z.string(),
  dateEnd: z.string(),
  /**
   * Whether the variance has been reconciled by a governed rule. ALWAYS
   * `application-heuristic` until a governed reconciliation engine is
   * wired. `governed` is reserved for future use.
   */
  reconciliationSource: z.enum(['application-heuristic', 'governed']),
})
export type MassBalanceLedger = z.infer<typeof MassBalanceLedgerSchema>
