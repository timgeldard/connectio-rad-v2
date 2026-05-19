import type {
  TraceInvestigationContext,
  BatchHeaderSummary,
  TraceNode,
  TraceEdge,
  TraceGraph,
  MassBalanceSummary,
  MassBalanceMovement,
  CustomerExposureSummary,
  SupplierExposureSummary,
  TraceEvent,
  CoAReleaseStatus,
  TraceRiskSignal,
  RelatedInvestigation,
  Trace2AdapterRequest,
} from '@connectio/data-contracts'
import type { AdapterResult, AdapterError } from '@connectio/source-adapters'
import {
  mockInvestigationContext,
  mockBatchHeader,
  mockTraceGraph,
  mockMassBalance,
  mockCustomerExposure,
  mockSupplierExposure,
  mockTraceEvents,
  mockCoAReleaseStatus,
  mockRiskSignals,
  mockRelatedInvestigations,
  mockTraceExposureForRelease,
} from './trace2-mock-data.js'

/**

/**
 * Resolves to an ISO 8601 timestamp representing "now".
 * Extracted so tests can override it without mocking `Date`.
 */
export type NowFn = () => string

const defaultNow: NowFn = () => new Date().toISOString()

/**
 * Creates a successful {@link AdapterResult} wrapping the given data.
 *
 * @param data - The payload to wrap.
 * @param now - ISO 8601 timestamp for `fetchedAt`. Defaults to current time.
 * @returns A successful AdapterResult.
 */
function ok<T>(data: T, now: NowFn = defaultNow): AdapterResult<T> {
  return { ok: true, data, fetchedAt: now() }
}

/**
 * Creates a failed {@link AdapterResult} wrapping an {@link AdapterError}.
 *
 * @param code - Machine-readable error category.
 * @param message - Human-readable error description.
 * @returns A failed AdapterResult.
 */
function err<T>(code: AdapterError['code'], message: string): AdapterResult<T> {
  return {
    ok: false,
    error: { code, message, retryable: code !== 'unauthorized' && code !== 'not-found' },
    displayState: code === 'unauthorized' ? 'unauthorized' : 'error',
  }
}

/**
 * Trace2 source adapter.
 *
 * @remarks
 * Phase 1 implementation returns realistic mock data matching the
 * `@connectio/data-contracts` trace-investigation schemas. All methods are
 * async so the API surface is identical to the eventual live implementation
 * (which will call the FastAPI `/api/trace2/…` endpoints).
 *
 * Do not add business logic here — this adapter maps raw source responses into
 * typed data-contract shapes. Business rules belong in the domain service layer.
 */
export class Trace2Adapter {
  /** Simulated network delay in milliseconds (0 disables simulation). */
  private readonly simulatedDelayMs: number

  /** Override for the "now" clock — useful in tests. */
  private readonly now: NowFn

  constructor(opts: { simulatedDelayMs?: number; now?: NowFn } = {}) {
    this.simulatedDelayMs = opts.simulatedDelayMs ?? 0
    this.now = opts.now ?? defaultNow
  }

  /**
   * Simulate async I/O latency when `simulatedDelayMs > 0`.
   * Resolved immediately in production builds.
   */
  private async delay(): Promise<void> {
    if (this.simulatedDelayMs > 0) {
      await new Promise<void>(resolve => setTimeout(resolve, this.simulatedDelayMs))
    }
  }

  /**
   * Fetches the investigation context record.
   *
   * @param request - Investigation and batch identifiers.
   * @returns The investigation context, or an error result.
   */
  async getInvestigationContext(
    _request: Trace2AdapterRequest,
  ): Promise<AdapterResult<TraceInvestigationContext>> {
    await this.delay()
    return ok(mockInvestigationContext, this.now)
  }

  /**
   * Fetches the batch header summary for the investigation's root batch.
   *
   * @param request - Investigation and batch identifiers.
   * @returns The batch header summary, or an error result.
   */
  async getBatchHeaderSummary(
    _request: Trace2AdapterRequest,
  ): Promise<AdapterResult<BatchHeaderSummary>> {
    await this.delay()
    return ok(mockBatchHeader, this.now)
  }

  /**
   * Fetches the full trace graph (upstream + downstream nodes and edges).
   *
   * @param request - Investigation and batch identifiers.
   * @returns The trace graph, or an error result.
   */
  async getTraceGraph(_request: Trace2AdapterRequest): Promise<AdapterResult<TraceGraph>> {
    await this.delay()
    return ok(mockTraceGraph, this.now)
  }

  /**
   * Fetches the mass balance summary for the root batch.
   *
   * @param request - Investigation and batch identifiers.
   * @returns The mass balance summary, or an error result.
   */
  async getMassBalanceSummary(
    _request: Trace2AdapterRequest,
  ): Promise<AdapterResult<MassBalanceSummary>> {
    await this.delay()
    return ok(mockMassBalance, this.now)
  }

  /**
   * Fetches the downstream customer exposure summary.
   *
   * @param request - Investigation and batch identifiers.
   * @returns The customer exposure summary, or an error result.
   */
  async getCustomerExposureSummary(
    _request: Trace2AdapterRequest,
  ): Promise<AdapterResult<CustomerExposureSummary>> {
    await this.delay()
    return ok(mockCustomerExposure, this.now)
  }

  /**
   * Fetches the upstream supplier exposure summary.
   *
   * @param request - Investigation and batch identifiers.
   * @returns The supplier exposure summary, or an error result.
   */
  async getSupplierExposureSummary(
    _request: Trace2AdapterRequest,
  ): Promise<AdapterResult<SupplierExposureSummary>> {
    await this.delay()
    return ok(mockSupplierExposure, this.now)
  }

  /**
   * Fetches the ordered event timeline for the investigation.
   *
   * @param request - Investigation and batch identifiers.
   * @returns An array of trace events, or an error result.
   */
  async getEventTimeline(
    _request: Trace2AdapterRequest,
  ): Promise<AdapterResult<readonly TraceEvent[]>> {
    await this.delay()
    return ok(mockTraceEvents, this.now)
  }

  /**
   * Fetches the CoA / release status for the root batch.
   *
   * @param request - Investigation and batch identifiers.
   * @returns The CoA release status, or an error result.
   */
  async getCoAReleaseStatus(
    _request: Trace2AdapterRequest,
  ): Promise<AdapterResult<CoAReleaseStatus>> {
    await this.delay()
    return ok(mockCoAReleaseStatus, this.now)
  }

  /**
   * Fetches active risk signals associated with the investigation.
   *
   * @param request - Investigation and batch identifiers.
   * @returns An array of risk signals, or an error result.
   */
  async getRiskSignals(
    _request: Trace2AdapterRequest,
  ): Promise<AdapterResult<readonly TraceRiskSignal[]>> {
    await this.delay()
    return ok(mockRiskSignals, this.now)
  }

  /**
   * Fetches related investigations (same batch, material, supplier, or customer).
   *
   * @param request - Investigation and batch identifiers.
   * @returns An array of related investigation records, or an error result.
   */
  async getRelatedInvestigations(
    _request: Trace2AdapterRequest,
  ): Promise<AdapterResult<readonly RelatedInvestigation[]>> {
    await this.delay()
    return ok(mockRelatedInvestigations, this.now)
  }

  /**
   * Fetches a trace exposure summary oriented for a batch release decision.
   *
   * @remarks
   * This method provides a release-decision view of the trace data — upstream/
   * downstream risk levels, affected parties, and open investigation links.
   * Consumed by the Quality Batch Release workspace's Trace Evidence panel.
   *
   * @param _request - Investigation and batch identifiers.
   * @returns The trace exposure for release summary, or an error result.
   */
  async getTraceExposureForRelease(
    _request: Trace2AdapterRequest,
  ): Promise<AdapterResult<TraceExposureForRelease>> {
    await this.delay()
    return ok(mockTraceExposureForRelease, this.now)
  }
}

/** Shared singleton adapter instance used across all Phase 1 panels and hooks. */
export const trace2Adapter = new Trace2Adapter()

/**
 * Extracts a plain {@link AdapterError}-shaped message from any thrown value.
 *
 * @param thrown - Value caught from a try/catch block.
 * @returns A normalised error result.
 */
export function toAdapterError<T>(thrown: unknown): AdapterResult<T> {
  const message = thrown instanceof Error ? thrown.message : String(thrown)
  return err<T>('unknown', message)
}
