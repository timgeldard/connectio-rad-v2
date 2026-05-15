import { useQuery } from '@tanstack/react-query'
import { processOrderReviewAdapter } from './process-order-review-adapter.js'
import type { ProcessOrderReviewAdapterRequest } from './process-order-review-adapter.js'

const STALE = 5 * 60 * 1000

export function useProcessOrderReviewContext(request: ProcessOrderReviewAdapterRequest) {
  return useQuery({
    queryKey: ['por-context', request.processOrderId ?? null, request.plantId ?? null],
    queryFn: () => processOrderReviewAdapter.getProcessOrderReviewContext(request),
    staleTime: STALE,
  })
}

export function useProcessOrderHeader(request: ProcessOrderReviewAdapterRequest) {
  return useQuery({
    queryKey: ['por-header', request.processOrderId ?? null, request.plantId ?? null],
    queryFn: () => processOrderReviewAdapter.getProcessOrderHeader(request),
    staleTime: STALE,
  })
}

export function useOrderProgressSummary(request: ProcessOrderReviewAdapterRequest) {
  return useQuery({
    queryKey: ['por-progress', request.processOrderId ?? null],
    queryFn: () => processOrderReviewAdapter.getOrderProgressSummary(request),
    staleTime: STALE,
  })
}

export function useExecutionTimeline(request: ProcessOrderReviewAdapterRequest) {
  return useQuery({
    queryKey: ['por-timeline', request.processOrderId ?? null, request.plantId ?? null],
    queryFn: () => processOrderReviewAdapter.getExecutionTimeline(request),
    staleTime: STALE,
  })
}

export function useOrderQualityContext(request: ProcessOrderReviewAdapterRequest) {
  return useQuery({
    queryKey: ['por-quality', request.processOrderId ?? null, request.batchId ?? null],
    queryFn: () => processOrderReviewAdapter.getOrderQualityContext(request),
    staleTime: STALE,
  })
}

export function useOrderStagingContext(request: ProcessOrderReviewAdapterRequest) {
  return useQuery({
    queryKey: ['por-staging', request.processOrderId ?? null, request.plantId ?? null],
    queryFn: () => processOrderReviewAdapter.getOrderStagingContext(request),
    staleTime: STALE,
  })
}

export function useRelatedBatchContext(request: ProcessOrderReviewAdapterRequest) {
  return useQuery({
    queryKey: ['por-batches', request.processOrderId ?? null, request.batchId ?? null],
    queryFn: () => processOrderReviewAdapter.getRelatedBatchContext(request),
    staleTime: STALE,
  })
}
