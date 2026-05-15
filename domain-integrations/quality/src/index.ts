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
