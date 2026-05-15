/**
 * @connectio/di-traceability
 *
 * Domain integration package for the Traceability workspace.
 * Provides workspace registration, evidence panels, and a typed API client
 * for forward/reverse batch trace and mass balance.
 */

export { traceabilityWorkspaceRegistration } from './registration.js'
export { TraceabilityWorkspace } from './TraceabilityWorkspace.js'
export type { TraceabilityWorkspaceProps } from './TraceabilityWorkspace.js'

export { TraceExposureSummaryPanel } from './panels/TraceExposureSummaryPanel.js'
export type { TraceExposureSummaryPanelProps } from './panels/TraceExposureSummaryPanel.js'

export { BatchLineagePanel } from './panels/BatchLineagePanel.js'
export type { BatchLineagePanelProps } from './panels/BatchLineagePanel.js'

export { createTraceabilityClient } from './traceabilityClient.js'
export type { BatchLineage } from './traceabilityClient.js'
