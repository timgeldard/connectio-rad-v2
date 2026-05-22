import { z } from 'zod'

export const HoldStatusSchema = z.enum(['pending', 'released', 'rejected'])
export type HoldStatus = z.infer<typeof HoldStatusSchema>

export const HoldEntrySchema = z.object({
  id: z.string(),
  reason: z.string(),
  reasonCode: z.string().nullable().optional(),
  qty: z.number(),
  uom: z.string(),
  opened: z.string(),
  resolved: z.string().nullable().optional(),
  owner: z.string(),
  status: HoldStatusSchema,
  detail: z.string(),
  resolution: z.string().nullable().optional(),
})
export type HoldEntry = z.infer<typeof HoldEntrySchema>

export const HoldsQtyByReasonSchema = z.object({
  code: z.string(),
  label: z.string(),
  qty: z.number(),
  color: z.string().nullable().optional(),
})
export type HoldsQtyByReason = z.infer<typeof HoldsQtyByReasonSchema>

/**
 * Active and resolved quality holds for a batch with quantity-by-reason
 * rollup. Holds are READ-ONLY from this UI — releases are posted from
 * other workflows. The presence of a hold does not imply blocking; see
 * the `qtyByReason` totals for full impact.
 */
export const HoldsLedgerSchema = z.object({
  activeHolds: z.array(HoldEntrySchema),
  resolvedHolds: z.array(HoldEntrySchema),
  qtyByReason: z.array(HoldsQtyByReasonSchema),
})
export type HoldsLedger = z.infer<typeof HoldsLedgerSchema>
