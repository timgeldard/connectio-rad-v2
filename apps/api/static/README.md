# Static Assets Directory

The compiled React frontend assets (`index.html` and `assets/`) in this directory are **intentionally committed to version control**.

## Why?
This repository deploys ConnectIO RAD V2 as a single Databricks App that combines the FastAPI backend with the static React bundle. By committing the built assets:
1. We eliminate the need for a Node.js build step during the Databricks deployment pipeline.
2. `databricks bundle deploy` can simply bundle these static files as-is alongside the Python backend.

## How to update
Whenever the frontend changes, run the preparation script before deploying:
```bash
npm run prepare:databricks
```
This script will build the frontend and copy the updated assets into this directory so they can be committed.

For more details, see `docs/deployment/databricks-apps.md`.
