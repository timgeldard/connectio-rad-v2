import { z } from 'zod'

// ---------------------------------------------------------------------------
// TraceInvestigationContext
// ---------------------------------------------------------------------------

export const TraceInvestigationContextSchema = z.object({
  investigationId: z.string(),
  status: z.enum(['open', 'in-progress', 'escalated', 'resolved', 'closed']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  materialId: z.string(),
  materialDescription: z.string(),
  batchId: z.string(),
  plantId: z.string(),
  plantName: z.string(),
  processOrderId: z.string().optional(),
  initiatedBy: z.string(),
  initiatedAt: z.string().datetime(),
  lastUpdatedAt: z.string().datetime(),
  scope: z
    .object({
      plantId: z.string().optional(),
      lineId: z.string().optional(),
      regionId: z.string().optional(),
      materialId: z.string().optional(),
      batchId: z.string().optional(),
      processOrderId: z.string().optional(),
    })
    .optional(),
  activeView: z.string().optional(),
})

export type TraceInvestigationContext = z.infer<typeof TraceInvestigationContextSchema>

// ---------------------------------------------------------------------------
// BatchHeaderSummary
// ---------------------------------------------------------------------------

export const BatchHeaderSummarySchema = z.object({
  materialId: z.string(),
  materialDescription: z.string(),
  batchId: z.string(),
  plantId: z.string(),
  plantName: z.string(),
  batchStatus: z.enum(['active', 'archived', 'blocked', 'deleted']),
  quantity: z.number().optional(),
  uom: z.string().optional(),
  manufactureDate: z.string().datetime().optional(),
  expiryDate: z.string().datetime().optional(),
  processOrderId: z.string().optional(),
  stockStatus: z.enum(['unrestricted', 'quality-inspection', 'blocked', 'returns', 'transit']),
  qualityStatus: z.enum(['accepted', 'rejected', 'pending', 'conditional', 'not-applicable']),
  releaseStatus: z.enum(['released', 'blocked', 'restricted', 'not-released', 'unknown']),
})

export type BatchHeaderSummary = z.infer<typeof BatchHeaderSummarySchema>

// ---------------------------------------------------------------------------
// TraceNode
// ---------------------------------------------------------------------------

export const TraceNodeSchema = z.object({
  id: z.string(),
  type: z.enum([
    'raw-material',
    'intermediate',
    'finished-good',
    'customer-delivery',
    'supplier-lot',
    'process-order',
  ]),
  materialId: z.string(),
  materialDescription: z.string(),
  batchId: z.string().optional(),
  plantId: z.string().optional(),
  quantity: z.number().optional(),
  uom: z.string().optional(),
  status: z.enum(['resolved', 'unresolved', 'blocked', 'partial']).optional(),
  riskLevel: z.enum(['none', 'low', 'medium', 'high', 'critical']).optional(),
})

export type TraceNode = z.infer<typeof TraceNodeSchema>

// ---------------------------------------------------------------------------
// TraceEdge
// ---------------------------------------------------------------------------

export const TraceEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  relationshipType: z.enum([
    'component-of',
    'produced-from',
    'split-from',
    'merged-into',
    'transferred-to',
    'delivered-to',
  ]),
  quantity: z.number().optional(),
  uom: z.string().optional(),
  movementType: z.string().optional(),
  documentReference: z.string().optional(),
})

export type TraceEdge = z.infer<typeof TraceEdgeSchema>

// ---------------------------------------------------------------------------
// TraceGraph
// ---------------------------------------------------------------------------

export const TraceGraphSchema = z.object({
  nodes: z.array(TraceNodeSchema),
  edges: z.array(TraceEdgeSchema),
  direction: z.enum(['forward', 'reverse', 'both']),
  depth: z.number().int().min(0),
  rootBatch: z.string(),
  upstreamCount: z.number().int().min(0),
  downstreamCount: z.number().int().min(0),
  unresolvedNodeCount: z.number().int().min(0),
})

export type TraceGraph = z.infer<typeof TraceGraphSchema>

// ---------------------------------------------------------------------------
// MassBalanceSummary
// ---------------------------------------------------------------------------

export const MassBalanceSummarySchema = z.object({
  inputQuantity: z.number(),
  outputQuantity: z.number(),
  varianceQuantity: z.number(),
  variancePercent: z.number(),
  uom: z.string(),
  confidence: z.number().min(0).max(1),
  unresolvedMovements: z.number().int().min(0),
})

export type MassBalanceSummary = z.infer<typeof MassBalanceSummarySchema>

// ---------------------------------------------------------------------------
// CustomerExposureSummary
// ---------------------------------------------------------------------------

export const CustomerExposureSummarySchema = z.object({
  affectedCustomers: z.number().int().min(0),
  affectedDeliveries: z.number().int().min(0),
  shippedQuantity: z.number().min(0),
  countries: z.array(z.string()),
  highestSeverity: z.enum(['none', 'low', 'medium', 'high', 'critical']),
  blockedDeliveries: z.number().int().min(0),
  recallRecommended: z.boolean(),
})

export type CustomerExposureSummary = z.infer<typeof CustomerExposureSummarySchema>

// ---------------------------------------------------------------------------
// SupplierExposureSummary
// ---------------------------------------------------------------------------

export const SupplierExposureSummarySchema = z.object({
  supplierCount: z.number().int().min(0),
  supplierLots: z.number().int().min(0),
  highestRiskSupplier: z.string().optional(),
  upstreamMaterials: z.number().int().min(0),
  openSupplierActions: z.number().int().min(0),
})

export type SupplierExposureSummary = z.infer<typeof SupplierExposureSummarySchema>

// ---------------------------------------------------------------------------
// TraceEvent
// ---------------------------------------------------------------------------

export const TraceEventSchema = z.object({
  eventId: z.string(),
  timestamp: z.string().datetime(),
  type: z.enum([
    'batch-created',
    'batch-moved',
    'batch-released',
    'batch-blocked',
    'investigation-opened',
    'investigation-updated',
    'investigation-escalated',
    'investigation-resolved',
    'evidence-added',
    'quality-decision',
    'system-alert',
    'user-action',
  ]),
  title: z.string(),
  description: z.string().optional(),
  sourceSystem: z.string(),
  actor: z.string().optional(),
  severity: z.enum(['info', 'warning', 'critical']).optional(),
})

export type TraceEvent = z.infer<typeof TraceEventSchema>

// ---------------------------------------------------------------------------
// CoAReleaseStatus
// ---------------------------------------------------------------------------

export const CoAReleaseStatusSchema = z.object({
  coaAvailable: z.boolean(),
  releaseStatus: z.enum(['released', 'not-released', 'conditional', 'blocked', 'unknown']),
  usageDecision: z.enum(['accept', 'reject', 'pending', 'conditional', 'not-set']),
  openQualityLots: z.number().int().min(0),
  failedCharacteristics: z.number().int().min(0),
  pendingResults: z.number().int().min(0),
  lastDecisionAt: z.string().datetime().optional(),
})

export type CoAReleaseStatus = z.infer<typeof CoAReleaseStatusSchema>

// ---------------------------------------------------------------------------
// TraceRiskSignal
// ---------------------------------------------------------------------------

export const TraceRiskSignalSchema = z.object({
  signalId: z.string(),
  title: z.string(),
  description: z.string(),
  severity: z.enum(['info', 'low', 'medium', 'high', 'critical']),
  source: z.string(),
  confidence: z.number().min(0).max(1),
  recommendedAction: z.string().optional(),
})

export type TraceRiskSignal = z.infer<typeof TraceRiskSignalSchema>

// ---------------------------------------------------------------------------
// RelatedInvestigation
// ---------------------------------------------------------------------------

export const RelatedInvestigationSchema = z.object({
  investigationId: z.string(),
  title: z.string(),
  status: z.enum(['open', 'in-progress', 'escalated', 'resolved', 'closed']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  relatedBy: z.enum([
    'same-batch',
    'same-material',
    'same-supplier',
    'same-customer',
    'same-plant',
    'linked-investigation',
  ]),
  openedAt: z.string().datetime(),
  owner: z.string().optional(),
})

export type RelatedInvestigation = z.infer<typeof RelatedInvestigationSchema>
