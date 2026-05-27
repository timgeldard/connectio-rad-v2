#!/usr/bin/env node
/**
 * Prepare (and optionally deploy) the Databricks Apps artifact.
 *
 * Run from the repository root:
 *   npm run prepare:databricks            # build + copy only
 *   npm run deploy:databricks             # build + copy + bundle deploy + force restart
 *   node scripts/prepare-databricks-app.mjs --deploy
 *
 * What it does:
 *   1. Applies safe defaults for VITE_* env vars (same-origin deployment)
 *   2. Builds the React frontend via nx
 *   3. Removes stale apps/api/static/
 *   4. Copies apps/web/dist → apps/api/static/
 *   5. Verifies apps/api/static/index.html exists
 *   6. (--deploy only) Runs `databricks bundle deploy --target uat`
 *   7. (--deploy only) Stops and starts the app to force pick-up of new bundle
 *      (bundle deploy uploads files but does NOT restart the app; without a
 *      stop/start the running container continues to serve the old bundle).
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

const args = process.argv.slice(2)
const shouldDeploy = args.includes('--deploy')
const target = (() => {
  const i = args.indexOf('--target')
  return i >= 0 && args[i + 1] ? args[i + 1] : 'uat'
})()
const appName = 'connectio-v2'

// ── 1. Environment defaults ────────────────────────────────────────────────
// For same-origin Databricks Apps deployment, all base URLs must be empty so
// fetch calls use relative paths (e.g. /api/trace2/...) against the current host.
//
// VITE_ADAPTER_MODE controls which HTTP adapter the frontend uses to reach the
// FastAPI backend — 'legacy-api' means real HTTP calls (not mock). It is
// independent of BACKEND_ADAPTER_MODE, which is a backend-only env var that
// controls whether FastAPI routes to Databricks directly or proxies to V1.
// 'legacy-api' is always the correct value here for a Databricks Apps deploy.
//
// Vite loads .env.local AFTER process.env and overrides it, so we temporarily
// rename apps/web/.env.local during the build to prevent dev localhost values
// from being baked into the production bundle.
const buildEnv = {
  ...process.env,
  VITE_ADAPTER_MODE: process.env.VITE_ADAPTER_MODE ?? 'legacy-api',
  VITE_TRACE_API_BASE_URL: '',
  VITE_WH360_API_BASE_URL: '',
  VITE_POH_API_BASE_URL: '',
  VITE_CQ_API_BASE_URL: '',
  VITE_LEGACY_API_BASE_URL: '',
  VITE_FEATURE_SPC_LIVE_SOURCES: 'true',
}

console.log('=== prepare-databricks-app ===')
console.log(`Adapter mode       : ${buildEnv.VITE_ADAPTER_MODE}`)
console.log(`Trace base URL     : "${buildEnv.VITE_TRACE_API_BASE_URL}" (empty = same-origin)`)
console.log(`WH360 base URL     : "${buildEnv.VITE_WH360_API_BASE_URL}" (empty = same-origin)`)
console.log(`POH base URL       : "${buildEnv.VITE_POH_API_BASE_URL}" (empty = same-origin)`)
console.log(`CQ base URL        : "${buildEnv.VITE_CQ_API_BASE_URL}" (empty = same-origin)`)
console.log(`Legacy API base URL: "${buildEnv.VITE_LEGACY_API_BASE_URL}" (empty = same-origin)`)
console.log(`SPC live sources   : ${buildEnv.VITE_FEATURE_SPC_LIVE_SOURCES}`)
console.log()

// ── 2. Build frontend ──────────────────────────────────────────────────────
// Temporarily hide .env.local so Vite cannot pick up localhost dev values.
// If .env.local.bak already exists a prior run crashed before restoring it — recover first.
if (existsSync(envLocalBak)) {
  renameSync(envLocalBak, envLocal)
  console.log('  Warning: found stale .env.local.bak from a prior run — restored before build')
}
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

if (!shouldDeploy) {
  console.log()
  console.log('Build artifact ready. To deploy + force restart, run:')
  console.log('  npm run deploy:databricks')
  process.exit(0)
}

// ── 6. Bundle deploy ──────────────────────────────────────────────────────
console.log(`\nStep 4/6: databricks bundle deploy --target ${target}`)
execSync(`databricks bundle deploy --target ${target}`, { cwd: root, stdio: 'inherit' })

// ── 7. Force restart (stop + start) ───────────────────────────────────────
// `bundle deploy` uploads files to the workspace but the running app keeps
// serving its previous snapshot. A stop/start cycle is required to pick up
// the new files. `apps start` automatically deploys from the workspace path.
console.log(`\nStep 5/6: databricks apps stop ${appName}`)
execSync(`databricks apps stop ${appName}`, { cwd: root, stdio: 'inherit' })

console.log(`\nStep 6/6: databricks apps start ${appName} (force restart)`)
execSync(`databricks apps start ${appName}`, { cwd: root, stdio: 'inherit' })

console.log('\nDeploy + restart complete. The app picks up the new bundle.')
