/**
 * @connectio/di-quality
 *
 * Domain integration package for the Quality workspace.
 * Phase 2: Quality Batch Release workspace, adapters, panels, views, and actions.
 */

export { qualityWorkspaceRegistration } from './registration.js'

export { QualityReleaseAdapter, qualityReleaseAdapter, toAdapterError } from './adapters/quality-release-adapter.js'
export type { QualityReleaseAdapterRequest, QualityReleaseAdapterOptions } from './adapters/quality-release-adapter.js'

export {
  useReleaseContext,
  useReleaseQueue,
  useReleaseSummary,
  useQualityResults,
  useCoAReadiness,
  useDeviations,
  useDecisionHistory,
} from './adapters/quality-release-queries.js'

// Evidence panels
export { ReleaseSummaryPanel } from './panels/release-summary-panel.js'
export type { ReleaseSummaryPanelProps } from './panels/release-summary-panel.js'

export { QualityResultsPanel } from './panels/quality-results-panel.js'
export type { QualityResultsPanelProps } from './panels/quality-results-panel.js'

export { CoAReadinessPanel } from './panels/coa-readiness-panel.js'
export type { CoAReadinessPanelProps } from './panels/coa-readiness-panel.js'

export { DeviationsPanel } from './panels/deviations-panel.js'
export type { DeviationsPanelProps } from './panels/deviations-panel.js'

export { DecisionHistoryPanel } from './panels/decision-history-panel.js'
export type { DecisionHistoryPanelProps } from './panels/decision-history-panel.js'

export { ReleaseQueuePanel } from './panels/release-queue-panel.js'
export type { ReleaseQueuePanelProps } from './panels/release-queue-panel.js'
