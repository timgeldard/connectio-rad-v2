# Deploying ConnectIO V2 to Databricks Apps

## Overview

ConnectIO V2 runs as a single Databricks App that combines a FastAPI backend
(the V2 proxy layer) with the React frontend served as static files.
Databricks Apps handles HTTPS termination, identity forwarding, and access
control — the app itself does not implement authentication.

```
Browser → Databricks Apps (TLS + OAuth2) → FastAPI (apps/api/)
                                              ├── /api/...   proxy routes → V1 backends
                                              └── /          static React bundle
```

> **Readiness caveat:** The packaging and proxy wiring described here are
> smoke-test ready (verified locally). V1 network connectivity from Databricks
> Apps compute has not been confirmed. Only `getBatchHeaderSummary` on the
> Trace2 adapter has been browser-verified against a real V1 endpoint. All
> other legacy-api adapter methods fall back to mock data until verified.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Databricks workspace (Premium or above) | Databricks Apps requires Unity Catalog enabled |
| Databricks CLI ≥ 0.220 | `databricks --version` |
| Python 3.11+ on the build machine | For local validation only |
| Node.js 20+ and npm 10+ | To build the React frontend |
| `connectio-v2` secret scope in the target workspace | See [Secret scope setup](#secret-scope-setup) |

---

## Secret scope setup

Create the scope and add the V1 backend URL secrets before the first deploy.
Replace the placeholder values with the actual internal service URLs for the
target environment.

```bash
# Create the scope (skip if it already exists)
databricks secrets create-scope connectio-v2

# V1 Trace2 backend
databricks secrets put-secret connectio-v2 v1-trace-api-base-url \
  --string-value "https://<trace2-service-host>"

# V1 Warehouse 360 backend
databricks secrets put-secret connectio-v2 v1-wh360-api-base-url \
  --string-value "https://<wh360-service-host>"

# V1 Process Order History backend
databricks secrets put-secret connectio-v2 v1-poh-api-base-url \
  --string-value "https://<poh-service-host>"

# V1 Connected Quality Lab backend
databricks secrets put-secret connectio-v2 v1-cq-api-base-url \
  --string-value "https://<cq-service-host>"
```

Secrets are encrypted at rest and never appear in logs or environment variable
listings. The app reads them at startup via the `valueFrom.secretScope`
references in `apps/api/app.yaml`.

---

## Build

Run these steps from the repository root.

### 1. Install dependencies

```bash
npm install
```

### 2. Build and package (recommended: use the preparation script)

```bash
npm run prepare:databricks
```

This runs `scripts/prepare-databricks-app.mjs`, which:

1. Sets safe VITE env var defaults for same-origin deployment
2. Builds the React frontend via `nx run web:build`
3. Removes any stale `apps/api/static/` directory
4. Copies `apps/web/dist/` → `apps/api/static/`
5. Verifies `apps/api/static/index.html` exists

#### Manual equivalent

```bash
VITE_ADAPTER_MODE=legacy-api \
VITE_TRACE_API_BASE_URL="" \
VITE_WH360_API_BASE_URL="" \
VITE_POH_API_BASE_URL="" \
VITE_CQ_API_BASE_URL="" \
npm exec nx -- run web:build

rm -rf apps/api/static
cp -r apps/web/dist apps/api/static
```

`VITE_ADAPTER_MODE` and the per-domain base URLs are baked into the bundle at
build time. Leave base URL vars empty for same-origin Databricks Apps
deployment so fetch calls resolve against the current host. Set them to the
full API host only when the React app and API are on different origins.

> **Note:** `apps/api/static/` is git-ignored. Rebuild and re-copy whenever
> the frontend changes.

### 3. Python dependencies

Databricks Apps installs Python packages from `apps/api/requirements.txt`.
This file lists only public PyPI packages:

```
fastapi>=0.111
uvicorn[standard]>=0.29
httpx>=0.27
```

`apps/api/pyproject.toml` also declares `shared-db = { workspace = true }` as
a uv workspace source, but Databricks Apps uses pip, not uv. None of the route
modules import `shared_db`, so `requirements.txt` without it is correct. Do
not add `shared-db` to `requirements.txt`.

---

## Deploy

```bash
# First deploy — creates the app
databricks apps deploy connectio-v2 \
  --source-code-path apps/api

# Subsequent deploys
databricks apps deploy connectio-v2 \
  --source-code-path apps/api
```

Databricks Apps reads `apps/api/app.yaml` automatically.
The app name (`connectio-v2`) must be consistent across deploys.

### Verify

```bash
databricks apps get connectio-v2
```

The `url` field in the response is the public HTTPS endpoint.
Open `<url>/health` — it should return `{"status": "ok"}`.

---

## Local production smoke-test

Run this before deploying to Databricks Apps to verify the build artefact is
self-contained and the proxy wiring is correct.

### Prerequisites

- Python 3.11+ with `pip`
- The frontend built and copied (run `npm run prepare:databricks` first)

### Steps

```bash
# Install Python deps (from repo root)
pip install -r apps/api/requirements.txt

# Start the local server from apps/api/ (single process is fine for smoke-test)
cd apps/api
V1_TRACE_API_BASE_URL="https://<trace2-host>" \
V1_WH360_API_BASE_URL="https://<wh360-host>" \
V1_POH_API_BASE_URL="https://<poh-host>" \
V1_CQ_API_BASE_URL="https://<cq-host>" \
uvicorn main:app --host 0.0.0.0 --port 8000
```

Omit the `V1_*` vars if the V1 backends are not reachable — proxy routes will return 503,
but the React app and `/health` should still work.

### What to check

| URL / request | Expected result |
|---|---|
| `GET http://localhost:8000/health` | `{"status": "ok"}` |
| `GET http://localhost:8000/` | React app loads (ConnectIO login or workspace shell) |
| `GET http://localhost:8000/?workspace=trace-investigation` | Trace workspace renders |
| Browser refresh on any `?workspace=X` URL | React app reloads correctly (search params preserved) |
| `POST http://localhost:8000/api/trace2/batch-header` body `{"material_id":"<id>","batch_id":"<id>"}` | V1 response (with V1 set) or `{"detail":"V1_TRACE_API_BASE_URL is not configured"}` 503 |
| `POST http://localhost:8000/api/wh360/warehouse-summary` body `{"warehouse_id":"<id>"}` | V1 response or 503 |
| `POST http://localhost:8000/api/por/order-header` body `{"process_order_id":"<id>"}` | V1 response or 503 |
| `GET http://localhost:8000/api/cq/lab/fails?plant_id=IE10` | V1 response or 503 |
| `GET http://localhost:8000/api/cq/lab/plants` | V1 response or 503 |

**Note:** all three proxy endpoints accept `snake_case` request fields only (`material_id`, `batch_id`,
`warehouse_id`, `process_order_id`, `plant_id`). The TypeScript adapters already send snake_case — do
not send camelCase to the proxy.

**Source badge:** With V1 reachable, the batch header panel should show
`source: legacy-api`. With V1 unreachable, only `getBatchHeaderSummary`
falls back to mock — all other methods always return mock data until
browser-verified.

**Static serving:** The app routes via URL search params (`?workspace=X`),
not URL path segments. Every navigation sends `GET /` to the server, which
`StaticFiles(html=True)` handles correctly. There are no path-segment deep
links that require a catch-all route.

---

## Databricks Apps smoke-test checklist

After deploying to Databricks Apps, verify in order:

- [ ] `databricks apps get connectio-v2` shows `state: RUNNING`
- [ ] `<url>/health` returns `{"status": "ok"}` (confirms uvicorn started)
- [ ] `<url>/` loads the React app without blank page or JS errors
- [ ] Navigate to a workspace (`?workspace=trace-investigation`) — renders correctly
- [ ] Browser refresh on `<url>/?workspace=trace-investigation` — React app reloads (not 404)
- [ ] `<url>/api/trace2/batch-header` (POST with `{"material_id":"<id>","batch_id":"<id>"}`) — returns data or a specific error (not 500)
- [ ] If V1 Trace2 is reachable: source badge shows `legacy-api`
- [ ] If V1 is unreachable: source badge shows `mock` (fallback working, not crash)
- [ ] Check Databricks Apps logs: `databricks apps logs connectio-v2` — no startup errors

**Expected failure (not a blocker):** WH360 and POH proxy routes will return
mock data until those V1 endpoints are browser-verified. The UI will render
but source badges will show `mock`.

---

## Serving static files from FastAPI

`apps/api/main.py` mounts the React bundle after all API routers:

```python
import os
from fastapi.staticfiles import StaticFiles

static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
```

Place this **after** all `app.include_router(...)` calls so API routes take
precedence over the static fallback.

**Why `html=True` is sufficient:** The app navigates entirely via URL search
parameters (`?workspace=X&view=Y`). The server always receives `GET /`
regardless of which workspace the user is viewing. A catch-all route for
path-segment deep links is not needed.

---

## Environment variable reference

| Variable | Source | Purpose |
|---|---|---|
| `V1_TRACE_API_BASE_URL` | Secret scope | Base URL of the V1 Trace2 proxy target |
| `V1_WH360_API_BASE_URL` | Secret scope | Base URL of the V1 Warehouse 360 proxy target |
| `V1_POH_API_BASE_URL` | Secret scope | Base URL of the V1 Process Order History proxy target |
| `V1_CQ_API_BASE_URL` | Secret scope | Base URL of the V1 Connected Quality backend |
| `BACKEND_ADAPTER_MODE` | app.yaml literal or secret | `legacy-api` (default) or `databricks-api`. Controls whether POH and CQ Lab routes query Databricks directly or proxy to V1. |
| `DATABRICKS_HOST` | Secret scope | Databricks workspace hostname (no `https://` prefix). Required when `BACKEND_ADAPTER_MODE=databricks-api`. Example: `myworkspace.azuredatabricks.net` |
| `SQL_WAREHOUSE_ID` | Secret scope | SQL Warehouse ID to run statements against. Required when `BACKEND_ADAPTER_MODE=databricks-api`. |
| `VITE_CQ_API_BASE_URL` | Build env | Frontend base URL for CQ API (empty = same-origin Databricks Apps deployment) |
| `ADAPTER_MODE` | app.yaml literal | Informational only — the frontend adapter mode is baked into the JS bundle at build time |
| `PYTHONUNBUFFERED` | app.yaml literal | Ensures FastAPI logs appear immediately in Databricks Apps log stream |
| `PORT` | Injected by Databricks Apps | Databricks may override the port; current app.yaml binds to 8000 regardless — align if needed |

### Databricks-api mode secrets

To enable native Databricks reads, add the following secrets and update `app.yaml`:

```bash
databricks secrets put-secret connectio-v2 backend-adapter-mode \
  --string-value "databricks-api"

databricks secrets put-secret connectio-v2 databricks-host \
  --string-value "<workspace>.azuredatabricks.net"

databricks secrets put-secret connectio-v2 sql-warehouse-id \
  --string-value "<warehouse-id>"
```

In `app.yaml`:
```yaml
env:
  - name: BACKEND_ADAPTER_MODE
    valueFrom:
      secretScope: connectio-v2
      secretKey: backend-adapter-mode
  - name: DATABRICKS_HOST
    valueFrom:
      secretScope: connectio-v2
      secretKey: databricks-host
  - name: SQL_WAREHOUSE_ID
    valueFrom:
      secretScope: connectio-v2
      secretKey: sql-warehouse-id
```

### Databricks Apps OAuth headers (identity forwarding)

Databricks Apps injects the following headers into every authenticated request. The backend reads these to extract the user's OAuth identity for Databricks queries:

| Header | Purpose | Verified in production? |
|---|---|---|
| `x-forwarded-access-token` | End-user OAuth bearer token | **TODO: verify** — assumed from documentation |
| `x-forwarded-user` | User identifier | **TODO: verify** — assumed from documentation |
| `x-forwarded-email` | User email address | **TODO: verify** — assumed from documentation |

If these header names differ in the actual Databricks Apps environment, update `apps/api/shared/query_service/identity.py` (`extract_user_identity()` function) and this table.

---

## Updating secrets

To rotate a V1 backend URL without redeploying the app:

```bash
databricks secrets put-secret connectio-v2 v1-trace-api-base-url \
  --string-value "https://<new-host>"
```

The running app reads secrets at startup only — restart the app after rotating:

```bash
databricks apps stop connectio-v2
databricks apps start connectio-v2
```

---

## CI/CD sketch

A minimal pipeline for automated deploys:

```yaml
# Example: GitHub Actions step sequence (adapt to your CI)
steps:
  - name: Install deps
    run: npm install

  - name: Build and package
    run: npm run prepare:databricks
    env:
      # Defaults to same-origin (empty base URLs). Override if cross-origin.
      VITE_ADAPTER_MODE: legacy-api

  - name: Deploy to Databricks
    run: |
      databricks apps deploy connectio-v2 \
        --source-code-path apps/api
    env:
      DATABRICKS_HOST: ${{ secrets.DATABRICKS_HOST }}
      DATABRICKS_TOKEN: ${{ secrets.DATABRICKS_TOKEN }}
```

Store `DATABRICKS_HOST` and `DATABRICKS_TOKEN` as CI secrets — never commit
them.

---

## Readiness status

| Area | Status | Notes |
|---|---|---|
| Build packaging | Smoke-test ready | `requirements.txt` contains only PyPI packages; `shared-db` excluded |
| Static serving | Smoke-test ready | `StaticFiles(html=True)` correct for search-param routing |
| Trace2 proxy | Partially verified | `getBatchHeaderSummary` browser-verified; other methods return mock |
| WH360 proxy | Not yet verified | Proxy route wired; all methods return mock until browser-verified |
| POH proxy | Not yet verified | Proxy route wired; all methods return mock until browser-verified |
| CQ Lab Board proxy | Not yet verified | Proxy routes wired (`/api/cq/lab/fails`, `/api/cq/lab/plants`); returns mock until browser-verified |
| V1 network connectivity | Not confirmed | Databricks Apps → V1 firewall/private link rules not tested |
| `databricks-api` adapter | Not implemented | All adapters are at `legacy-api` or `mock` tier |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `/health` returns 503 | App failed to start; uvicorn crash | Check `databricks apps logs connectio-v2` |
| Proxy returns 503 on `/api/trace2/batch-header` | `V1_TRACE_API_BASE_URL` secret missing or empty | Re-run `databricks secrets put-secret` |
| Proxy returns 502 | V1 backend unreachable from Databricks network | Verify firewall / private link rules allow egress from the Apps compute to the V1 host |
| React app shows blank page | Static files not copied before deploy | Re-run `npm run prepare:databricks`, then redeploy |
| App returns 401 on all routes | Databricks Apps OAuth2 token not forwarded | Ensure the app's permission settings allow the relevant user groups |
| Source badge shows `mock` instead of `legacy-api` | `VITE_ADAPTER_MODE` was not `legacy-api` at build time | Rebuild with `npm run prepare:databricks` (sets `legacy-api` by default) |
| pip install fails during deploy | `shared-db` in requirements | Ensure `apps/api/requirements.txt` is present and does not include `shared-db` |
