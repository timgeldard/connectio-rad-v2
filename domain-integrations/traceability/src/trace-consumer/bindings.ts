import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'

/** Active trace request resolved by the designed search experience. */
export interface ResolvedTraceConsumerRequest {
  readonly materialId: string
  readonly batchId: string
  readonly plantId: string
}

/** Search fixture row used by the Trace Consumer POC search flow. */
export interface TraceConsumerSearchItem {
  readonly materialId: string
  readonly materialDescription: string
  readonly batchId: string
  readonly plantId: string
  readonly plantName: string
}

/** Plant option shown when a material/batch exists in more than one plant. */
export interface TraceConsumerPlantOption {
  readonly id: string
  readonly name: string
}

/** Batch search result grouped for the designed picker. */
export interface TraceConsumerMatchedBatch {
  readonly batchId: string
  readonly materialId: string
  readonly materialDescription: string
  readonly plants: TraceConsumerPlantOption[]
}

/** Material search result grouped for the designed picker. */
export interface TraceConsumerMatchedMaterial {
  readonly materialId: string
  readonly description: string
  readonly batchId: string
  readonly plants: TraceConsumerPlantOption[]
}

/** Search steps in the designed Trace Consumer journey. */
export type TraceConsumerSearchStep =
  | 'idle'
  | 'batches-for-material'
  | 'materials-for-batch'
  | 'select-plant'
  | 'no-results'

/** Primary tabs in the designed Trace Consumer investigation canvas. */
export type TraceConsumerTab =
  | 'lineage'
  | 'timeline'
  | 'risks'
  | 'insights'
  | 'passport'

export type TraceConsumerSearchResult =
  | {
      readonly step: 'batches-for-material'
      readonly batches: TraceConsumerMatchedBatch[]
      readonly selectedMaterial: { readonly id: string; readonly description: string }
    }
  | {
      readonly step: 'materials-for-batch'
      readonly materials: TraceConsumerMatchedMaterial[]
      readonly selectedBatch: string
    }
  | {
      readonly step: 'resolved'
      readonly request: ResolvedTraceConsumerRequest
    }
  | {
      readonly step: 'no-results'
    }

/** Convert the designed-app request into the existing Trace2 query contract. */
export function createTraceConsumerAdapterRequest(
  request: ResolvedTraceConsumerRequest,
): Trace2AdapterRequest {
  return {
    materialId: request.materialId,
    batchId: request.batchId,
    plantId: request.plantId,
    investigationId: 'consumer-trace',
    direction: 'both',
    maxDepth: 2,
    maxEdges: 100,
  }
}

/** Resolve free-text POC search input into the next designed-app search state. */
export function resolveTraceConsumerSearch(
  rawQuery: string,
  searchItems: readonly TraceConsumerSearchItem[],
): TraceConsumerSearchResult {
  const query = rawQuery.trim()
  const itemsByMaterial = searchItems.filter(
    item =>
      item.materialId === query ||
      item.materialDescription.toLowerCase().includes(query.toLowerCase()),
  )
  const itemsByBatch = searchItems.filter(
    item => item.batchId.toLowerCase() === query.toLowerCase(),
  )

  if (itemsByMaterial.length > 0) {
    const batchesMap: Record<string, TraceConsumerMatchedBatch> = {}
    itemsByMaterial.forEach(item => {
      if (!batchesMap[item.batchId]) {
        batchesMap[item.batchId] = {
          batchId: item.batchId,
          materialId: item.materialId,
          materialDescription: item.materialDescription,
          plants: [],
        }
      }
      if (!batchesMap[item.batchId].plants.some(plant => plant.id === item.plantId)) {
        batchesMap[item.batchId].plants.push({ id: item.plantId, name: item.plantName })
      }
    })
    const batches = Object.values(batchesMap)
    return {
      step: 'batches-for-material',
      batches,
      selectedMaterial: {
        id: batches[0].materialId,
        description: batches[0].materialDescription,
      },
    }
  }

  if (itemsByBatch.length > 0) {
    const materialsMap: Record<string, TraceConsumerMatchedMaterial> = {}
    itemsByBatch.forEach(item => {
      if (!materialsMap[item.materialId]) {
        materialsMap[item.materialId] = {
          materialId: item.materialId,
          description: item.materialDescription,
          batchId: item.batchId,
          plants: [],
        }
      }
      if (!materialsMap[item.materialId].plants.some(plant => plant.id === item.plantId)) {
        materialsMap[item.materialId].plants.push({ id: item.plantId, name: item.plantName })
      }
    })
    const materials = Object.values(materialsMap)
    return {
      step: 'materials-for-batch',
      materials,
      selectedBatch: materials[0].batchId,
    }
  }

  if (/^\d{8}$/.test(query)) {
    return { step: 'no-results' }
  }

  if (query.includes('-') || query.length >= 10) {
    return {
      step: 'resolved',
      request: { materialId: '', batchId: query, plantId: '' },
    }
  }

  return { step: 'no-results' }
}
