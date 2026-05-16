#!/usr/bin/env node
/**
 * Prepare the Databricks Apps deploy artifact.
 *
 * Run from the repository root:
 *   npm run prepare:databricks
 *   (or: node scripts/prepare-databricks-app.mjs)
 *
 * What it does:
 *   1. Applies safe defaults for VITE_* env vars (same-origin deployment)
 *   2. Builds the React frontend via nx
 *   3. Removes stale apps/api/static/
 *   4. Copies apps/web/dist → apps/api/static/
 *   5. Verifies apps/api/static/index.html exists
 *
 * After running this script, deploy with:
 *   databricks apps deploy connectio-v2 --source-code-path apps/api
 */

import { execSync } from 'node:child_process'
import { existsSync, rmSync, cpSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const distDir = join(root, 'apps', 'web', 'dist')
const staticDir = join(root, 'apps', 'api', 'static')

// ── 1. Environment defaults ────────────────────────────────────────────────
// Override individual vars before running if targeting a cross-origin deployment.
// For standard same-origin Databricks Apps deployment, empty base URLs are correct
// (relative fetch paths like /api/trace2/... resolve against the current host).
const buildEnv = {
  ...process.env,
  VITE_ADAPTER_MODE: process.env.VITE_ADAPTER_MODE ?? 'legacy-api',
  VITE_TRACE_API_BASE_URL: process.env.VITE_TRACE_API_BASE_URL ?? '',
  VITE_WH360_API_BASE_URL: process.env.VITE_WH360_API_BASE_URL ?? '',
  VITE_POH_API_BASE_URL: process.env.VITE_POH_API_BASE_URL ?? '',
  VITE_CQ_API_BASE_URL: process.env.VITE_CQ_API_BASE_URL ?? '',
}

console.log('=== prepare-databricks-app ===')
console.log(`Adapter mode       : ${buildEnv.VITE_ADAPTER_MODE}`)
console.log(`Trace base URL     : "${buildEnv.VITE_TRACE_API_BASE_URL}" (empty = same-origin)`)
console.log(`WH360 base URL     : "${buildEnv.VITE_WH360_API_BASE_URL}" (empty = same-origin)`)
console.log(`POH base URL       : "${buildEnv.VITE_POH_API_BASE_URL}" (empty = same-origin)`)
console.log(`CQ base URL        : "${buildEnv.VITE_CQ_API_BASE_URL}" (empty = same-origin)`)
console.log()

// ── 2. Build frontend ──────────────────────────────────────────────────────
console.log('Step 1/3: Building React frontend (nx run web:build)...')
execSync('npm exec nx -- run web:build', { cwd: root, stdio: 'inherit', env: buildEnv })

// ── 3. Clean stale static/ ─────────────────────────────────────────────────
console.log('\nStep 2/3: Refreshing apps/api/static/')
if (existsSync(staticDir)) {
  rmSync(staticDir, { recursive: true, force: true })
  console.log('  Removed stale apps/api/static/')
}

// ── 4. Copy dist → static/ ────────────────────────────────────────────────
cpSync(distDir, staticDir, { recursive: true })
console.log('  Copied apps/web/dist → apps/api/static/')

// ── 5. Verify ─────────────────────────────────────────────────────────────
const indexHtml = join(staticDir, 'index.html')
if (!existsSync(indexHtml)) {
  console.error('\nERROR: apps/api/static/index.html not found — build may have failed.')
  process.exit(1)
}

console.log('\nStep 3/3: Verified apps/api/static/index.html present.')
console.log()
console.log('Ready to deploy:')
console.log('  databricks apps deploy connectio-v2 --source-code-path apps/api')
