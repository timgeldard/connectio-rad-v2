<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

## Code Modification Rules

- **Functional preservation first:** Before any change, verify that existing panels, adapters, data contracts, and tests remain intact. Never remove a passing test, existing panel, or Zod schema field without explicit instruction.
- **No speculative proxy routes:** Do not add FastAPI routes or legacy-api adapter overrides unless the V1 endpoint is confirmed to exist *and* has been browser-tested against a live V1 backend. Wired-but-unverified routes already exist — do not add more.
- **No mock-only parity claims:** Do not claim a feature or panel has parity with V1 if the data source is mock only. Parity claims require browser-verified legacy-api data or direct databricks-api validation against the same gold view V1 queries.
- **No hardcoded mature-domain behaviour:** Do not assume V1 field names, enum values, or business rules when implementing new mock data or schemas. Use the Zod schemas in `@connectio/data-contracts` as the single source of truth; update them first if domain knowledge changes.

## Databricks Data-Access Security Rules

- Production Databricks reads in V2 must use the authenticated end user's OAuth identity.
- Do not introduce service-principal fallback paths for user-facing reads.
- If user OAuth is unavailable, mark databricks-api mode as blocked rather than bypassing identity controls.
