/**
 * @connectio/di-spc
 *
 * Domain integration package for the SPC workspace.
 * Phase 2: SPC signals adapter consumed by Quality Batch Release workspace.
 */

export { spcWorkspaceRegistration } from './registration.js'

export { SPCSignalsAdapter, spcSignalsAdapter, toAdapterError } from './adapters/spc-signals-adapter.js'
export type { SPCSignalsAdapterRequest, SPCSignalsAdapterOptions } from './adapters/spc-signals-adapter.js'

export { useSPCSignals } from './adapters/spc-signals-queries.js'
