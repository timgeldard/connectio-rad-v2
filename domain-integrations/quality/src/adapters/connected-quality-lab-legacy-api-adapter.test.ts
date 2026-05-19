import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ConnectedQualityLabLegacyApiAdapter } from './connected-quality-lab-legacy-api-adapter.js'

describe('ConnectedQualityLabLegacyApiAdapter', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses relative same-origin URL when baseUrl is empty', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ fails: [], data_available: true }), { status: 200 }),
    )
    const adapter = new ConnectedQualityLabLegacyApiAdapter('')
    await adapter.getLabFailures({})
    expect(fetchSpy).toHaveBeenCalledOnce()
    const url = fetchSpy.mock.calls[0][0] as string
    expect(url).toMatch(/^\/api\/cq\/lab\/fails/)
  })

  it('prepends baseUrl when provided', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ fails: [], data_available: true }), { status: 200 }),
    )
    const adapter = new ConnectedQualityLabLegacyApiAdapter('https://example.com')
    await adapter.getLabFailures({})
    expect(fetchSpy).toHaveBeenCalledOnce()
    const url = fetchSpy.mock.calls[0][0] as string
    expect(url).toMatch(/^https:\/\/example\.com\/api\/cq\/lab\/fails/)
  })

  it('handles error responses status >= 400', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Internal Server Error', { status: 500 }),
    )
    const adapter = new ConnectedQualityLabLegacyApiAdapter('')
    const result = await adapter.getLabFailures({})
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.source).toBe('legacy-api')
      expect(result.error.message).toContain('Proxy returned 500')
    }
  })

  it('returns ok: true with empty data when legacy fails array is missing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data_available: true }), { status: 200 }),
    )
    const adapter = new ConnectedQualityLabLegacyApiAdapter('')
    const result = await adapter.getLabFailures({})
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.fails).toEqual([])
    }
  })

  it('returns source legacy-api on successful getLabFailures', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ fails: [], data_available: true }), { status: 200 }),
    )
    const adapter = new ConnectedQualityLabLegacyApiAdapter('')
    const result = await adapter.getLabFailures({})
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.source).toBe('legacy-api')
  })

  it('falls back to mock on network error for getLabPlants', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network failure'))
    const adapter = new ConnectedQualityLabLegacyApiAdapter('')
    const result = await adapter.getLabPlants()
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.source).toBe('mock')
      expect(result.data.plants.length).toBeGreaterThan(0)
    }
  })

  it('returns error result on network error for getLabFailures', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('connection refused'))
    const adapter = new ConnectedQualityLabLegacyApiAdapter('')
    const result = await adapter.getLabFailures({})
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.source).toBe('legacy-api')
      expect(result.error.retryable).toBe(true)
    }
  })

  it('strips trailing slash from baseUrl', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ fails: [], data_available: true }), { status: 200 }),
    )
    const adapter = new ConnectedQualityLabLegacyApiAdapter('https://example.com/')
    await adapter.getLabFailures({})
    const url = fetchSpy.mock.calls[0][0] as string
    expect(url).not.toContain('//api')
  })
})

describe('prepare-databricks-app.mjs CQ env var', () => {
  it('documents VITE_CQ_API_BASE_URL in the prepare script', () => {
    let scriptPath = join(process.cwd(), 'scripts/prepare-databricks-app.mjs')
    if (!existsSync(scriptPath)) {
      scriptPath = join(process.cwd(), '../../scripts/prepare-databricks-app.mjs')
    }
    const content = readFileSync(scriptPath, 'utf-8')
    expect(content).toContain('VITE_CQ_API_BASE_URL')
  })
})
