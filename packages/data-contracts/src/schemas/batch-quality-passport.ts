import { z } from 'zod'

/**
 * Quality characteristic (CoA row) — one measured spec on a batch.
 * `status` is server-decided; the panel renders the visual based on it.
 * `binary` is set for go/no-go characteristics (e.g. Listeria "Absent").
 */
export const QualityCharacteristicSchema = z.object({
  mic: z.string(),
  param: z.string(),
  low: z.number(),
  high: z.number(),
  target: z.number(),
  actual: z.number(),
  uom: z.string(),
  status: z.enum(['ok', 'warn', 'fail']),
  binary: z.string().nullable().optional(),
})
export type QualityCharacteristic = z.infer<typeof QualityCharacteristicSchema>

export const LotHistoryEntrySchema = z.object({
  id: z.string(),
  date: z.string(),
  inspection: z.string(),
  result: z.enum(['accept', 'conditional', 'reject']),
  mics: z.number().int(),
  failed: z.number().int(),
  decisionBy: z.string(),
})
export type LotHistoryEntry = z.infer<typeof LotHistoryEntrySchema>

export const PassportIdentitySchema = z.object({
  materialDescription: z.string(),
  materialId: z.string(),
  batchId: z.string(),
  plantName: z.string(),
  plantId: z.string(),
  processOrderId: z.string(),
  manufactureDate: z.string(),
  expiryDate: z.string(),
  daysToExpiry: z.number().int(),
  uom: z.string(),
})
export type PassportIdentity = z.infer<typeof PassportIdentitySchema>

export const PassportQualitySchema = z.object({
  confidence: z.number().min(0).max(100),
  overallStatus: z.enum(['accepted', 'conditional', 'rejected']),
  notes: z.array(z.string()),
  coa: z.array(QualityCharacteristicSchema),
})
export type PassportQuality = z.infer<typeof PassportQualitySchema>

export const PassportStockSchema = z.object({
  unrestricted: z.number(),
  qualityInspection: z.number(),
  blocked: z.number(),
  restricted: z.number(),
  transit: z.number(),
  uom: z.string(),
})
export type PassportStock = z.infer<typeof PassportStockSchema>

export const PassportProductionSchema = z.object({
  orderId: z.string(),
  line: z.string(),
  operator: z.string(),
  startedAt: z.string(),
  confirmedAt: z.string(),
  plannedQty: z.number(),
  actualQty: z.number(),
  yield: z.number(),
  originatingCustomer: z.string(),
  notes: z.string(),
})
export type PassportProduction = z.infer<typeof PassportProductionSchema>

export const PassportMassBalanceSchema = z.object({
  variance: z.number(),
  note: z.string(),
  detailUrl: z.string().nullable().optional(),
})
export type PassportMassBalance = z.infer<typeof PassportMassBalanceSchema>

export const PassportSignoffSchema = z.object({
  role: z.string(),
  name: z.string(),
  status: z.enum(['signed', 'pending', 'not-required']),
  time: z.string(),
})
export type PassportSignoff = z.infer<typeof PassportSignoffSchema>

/**
 * Batch Quality Passport — consolidated quality identity card for a batch.
 *
 * Audience-aware: internal mode shows full detail; external (customer-safe)
 * mode masks supplier names, plant code, process order, reviewer names, and
 * production line/operator. Backend must enforce masking; frontend visually
 * adapts when the audience flag is set.
 */
export const BatchQualityPassportSchema = z.object({
  identity: PassportIdentitySchema,
  quality: PassportQualitySchema,
  stock: PassportStockSchema,
  production: PassportProductionSchema,
  lotHistory: z.array(LotHistoryEntrySchema),
  massBalance: PassportMassBalanceSchema,
  signoff: z.array(PassportSignoffSchema),
})
export type BatchQualityPassport = z.infer<typeof BatchQualityPassportSchema>
