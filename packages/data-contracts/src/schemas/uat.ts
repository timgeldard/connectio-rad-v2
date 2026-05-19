import { z } from 'zod'

/**
 * Standardized structure for UAT evidence capture.
 * Used for "Copy Evidence" actions across all domains.
 */
export const UATEvidencePayloadSchema = z.object({
  domain: z.string(),
  workspace: z.string(),
  capturedAt: z.string().datetime(),
  adapterMode: z.string(),
  inputs: z.record(z.any()),
  sourceSummary: z.object({
    overall: z.enum(['mock', 'legacy-api', 'databricks-api', 'mixed', 'unavailable', 'unknown']),
    sections: z.record(z.string()).optional(),
  }),
  evidenceCompleteness: z.object({
    status: z.enum(['loaded', 'partial', 'mock-only', 'unavailable', 'pending-validation', 'error', 'permission-denied', 'timed-out']),
    sections: z.record(z.string()).optional(),
  }),
  counts: z.record(z.number()).optional(),
  warnings: z.array(z.string()),
  uatNotes: z.array(z.string()).default([
    'No live validation claimed.',
    'Unavailable evidence must not be interpreted as zero exposure or no risk.',
  ]),
})

export type UATEvidencePayload = z.infer<typeof UATEvidencePayloadSchema>
