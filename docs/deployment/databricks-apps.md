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

Create the scope and add the three V1 backend URL secrets before the first
deploy. Replace the placeholder values with the actual internal service URLs
for the target environment.

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

### 2. Build the React frontend

```bash
npm exec nx -- run web:build
```

This produces a production bundle in `apps/web/dist/`.
`VITE_ADAPTER_MODE` is baked into the bundle at build time — set it before
building if you need a value other than the `.env` default.

```bash
# Build targeting the legacy-api adapter (typical for production)
VITE_ADAPTER_MODE=legacy-api npm exec nx -- run web:build
```

### 3. Copy static files into the API directory

FastAPI serves the React bundle as static files via `StaticFiles`.

```bash
cp -r apps/web/dist apps/api/static
```

> **Note:** `apps/api/static/` is git-ignored. Rebuild and re-copy whenever
> the frontend changes.

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

## Serving static files from FastAPI

Add the following to `apps/api/main.py` when deploying to Databricks Apps.
The static directory is created during the build step above and is absent in
local development (where Vite serves the frontend directly).

```python
import os
from fastapi.staticfiles import StaticFiles

static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
```

Place this **after** all `app.include_router(...)` calls so API routes take
precedence over the static fallback.

---

## Environment variable reference

| Variable | Source | Purpose |
|---|---|---|
| `V1_TRACE_API_BASE_URL` | Secret scope | Base URL of the V1 Trace2 proxy target |
| `V1_WH360_API_BASE_URL` | Secret scope | Base URL of the V1 Warehouse 360 proxy target |
| `V1_POH_API_BASE_URL` | Secret scope | Base URL of the V1 Process Order History proxy target |
| `ADAPTER_MODE` | app.yaml literal | Informational only — the frontend adapter mode is baked into the JS bundle at build time |
| `PYTHONUNBUFFERED` | app.yaml literal | Ensures FastAPI logs appear immediately in Databricks Apps log stream |
| `PORT` | Injected by Databricks Apps | Databricks may override the port; current app.yaml binds to 8000 regardless — align if needed |

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

  - name: Build frontend
    run: VITE_ADAPTER_MODE=legacy-api npm exec nx -- run web:build

  - name: Copy static files
    run: cp -r apps/web/dist apps/api/static

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

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `/health` returns 503 | App failed to start; uvicorn crash | Check `databricks apps logs connectio-v2` |
| Proxy returns 503 on `/api/trace2/batch-header` | `V1_TRACE_API_BASE_URL` secret missing or empty | Re-run `databricks secrets put-secret` |
| Proxy returns 502 | V1 backend unreachable from Databricks network | Verify firewall / private link rules allow egress from the Apps compute to the V1 host |
| React app shows blank page | Static files not copied before deploy | Re-run the build and copy steps, then redeploy |
| App returns 401 on all routes | Databricks Apps OAuth2 token not forwarded | Ensure the app's permission settings allow the relevant user groups |
