# Data Contract Generation and Drift Detection

## Overview

Data contracts are defined as Zod schemas in `packages/data-contracts/src/schemas/`. These Zod schemas are the canonical source of truth. From them, two derived artifacts are generated:

1. **`packages/data-contracts/dist-schema/contracts.json`** — JSON Schema (intermediate)
2. **`apps/api/contracts/generated.py`** — Pydantic V2 models used by the FastAPI backend

Both artifacts are committed to the repository and must stay in sync with the Zod schemas. When a schema changes and the generated files are not regenerated, a **drift** condition exists.

---

## How to regenerate

Run the following command from the repository root:

```sh
npx nx run data-contracts:sync-pydantic
```

This runs a two-step pipeline:

| Step | Tool                                                                | Input                                  | Output                            |
| ---- | ------------------------------------------------------------------- | -------------------------------------- | --------------------------------- |
| 1    | `zod-to-json-schema` via `scripts/export-json-schema.ts`            | `src/index.ts` (all `*Schema` exports) | `dist-schema/contracts.json`      |
| 2    | `datamodel-code-generator` via `apps/api/scripts/sync_contracts.py` | `dist-schema/contracts.json`           | `apps/api/contracts/generated.py` |

After running `sync-pydantic`, commit both generated files together with the Zod schema change.

---

## Drift detection

To detect drift between the Zod schemas and the generated artifacts, run:

```sh
npx nx run data-contracts:check-pydantic
```

This command:

1. Runs `sync-pydantic` to regenerate both artifacts from the current Zod schemas.
2. Runs `git diff --exit-code` on the generated files.
   - **Exit 0** → no drift: the committed artifacts match what generation produces.
   - **Non-zero exit** → drift detected: the committed artifacts are stale.

If drift is detected, the diff shows exactly which lines changed. Commit the regenerated files to resolve.

### When to run

- Before merging any PR that modifies `packages/data-contracts/src/schemas/`
- Before merging any PR that changes `packages/data-contracts/scripts/export-json-schema.ts`
- Before merging any PR that changes `apps/api/scripts/sync_contracts.py`
- When `apps/api/contracts/generated.py` shows unexpected content in a code review

---

## Python compatibility caveat

The generation pipeline uses `datamodel-code-generator` with `--target-python-version 3.11`. The FastAPI backend targets Python 3.11 and the generated models must remain compatible with it.

If you see `datamodel-code-generator` output that uses syntax unavailable in Python 3.11 (e.g., `X | Y` union syntax without `from __future__ import annotations`), check whether the `--target-python-version` flag is set correctly in `apps/api/scripts/sync_contracts.py`.

---

## Troubleshooting

**`check-pydantic` fails immediately with "sync-pydantic" error**

The TypeScript export step requires `tsx`. If not installed globally, run:

```sh
pnpm install
```

from the repo root to ensure workspace devDependencies are available.

**`sync_contracts.py` fails with "datamodel_code_generator not found"**

The Python generator is a backend dev dependency. Install it via:

```sh
uv run --project apps/api pip install datamodel-code-generator
```

or ensure `apps/api/pyproject.toml` includes it and run `uv sync --project apps/api`.

**Generated files change unexpectedly after sync**

This usually means:

- A Zod schema changed and `sync-pydantic` was not run.
- The `zod-to-json-schema` or `datamodel-code-generator` version changed (check `package.json` / `pyproject.toml` lock files).
- The `export-json-schema.ts` post-processor regex changed (anyOf → type normalization).

Run `git diff HEAD packages/data-contracts packages/data-contracts/scripts` to identify the source change.

---

## File locations

| File                                                    | Purpose                              | Edit?                        |
| ------------------------------------------------------- | ------------------------------------ | ---------------------------- |
| `packages/data-contracts/src/schemas/*.ts`              | Zod schema definitions — edit here   | Yes                          |
| `packages/data-contracts/src/index.ts`                  | Re-exports all schemas               | When adding a new schema     |
| `packages/data-contracts/scripts/export-json-schema.ts` | Zod → JSON Schema conversion         | Only for tooling changes     |
| `apps/api/scripts/sync_contracts.py`                    | JSON Schema → Pydantic V2 conversion | Only for tooling changes     |
| `packages/data-contracts/dist-schema/contracts.json`    | Intermediate JSON Schema artifact    | Generated — do not hand-edit |
| `apps/api/contracts/generated.py`                       | Pydantic V2 backend models           | Generated — do not hand-edit |
