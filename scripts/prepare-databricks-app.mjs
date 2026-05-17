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
import { existsSync, rmSync, cpSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const distDir = join(root, 'apps', 'web', 'dist')
const staticDir = join(root, 'apps', 'api', 'static')
const envLocal = join(root, 'apps', 'web', '.env.local')
const envLocalBak = join(root, 'apps', 'web', '.env.local.bak')

// ── 1. Environment defaults ────────────────────────────────────────────────
// For same-origin Databricks Apps deployment, all base URLs must be empty so
// fetch calls use relative paths (e.g. /api/trace2/...) against the current host.
//
// Vite loads .env.local AFTER process.env and overrides it, so we temporarily
// rename apps/web/.env.local during the build to prevent dev localhost values
// from being baked into the production bundle.
const buildEnv = {
  ...process.env,
  VITE_ADAPTER_MODE: 'legacy-api',
  VITE_TRACE_API_BASE_URL: '',
  VITE_WH360_API_BASE_URL: '',
  VITE_POH_API_BASE_URL: '',
  VITE_CQ_API_BASE_URL: '',
}

console.log('=== prepare-databricks-app ===')
console.log(`Adapter mode       : ${buildEnv.VITE_ADAPTER_MODE}`)
console.log(`Trace base URL     : "${buildEnv.VITE_TRACE_API_BASE_URL}" (empty = same-origin)`)
console.log(`WH360 base URL     : "${buildEnv.VITE_WH360_API_BASE_URL}" (empty = same-origin)`)
console.log(`POH base URL       : "${buildEnv.VITE_POH_API_BASE_URL}" (empty = same-origin)`)
console.log(`CQ base URL        : "${buildEnv.VITE_CQ_API_BASE_URL}" (empty = same-origin)`)
console.log()

// ── 2. Build frontend ──────────────────────────────────────────────────────
// Temporarily hide .env.local so Vite cannot pick up localhost dev values.
const hadEnvLocal = existsSync(envLocal)
if (hadEnvLocal) {
  renameSync(envLocal, envLocalBak)
  console.log('  Temporarily renamed apps/web/.env.local (restored after build)')
}

console.log('Step 1/3: Building React frontend (nx run web:build --skip-nx-cache)...')
try {
  execSync('npm exec nx -- run web:build --skip-nx-cache', { cwd: root, stdio: 'inherit', env: buildEnv })
} finally {
  if (hadEnvLocal) renameSync(envLocalBak, envLocal)
}

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
