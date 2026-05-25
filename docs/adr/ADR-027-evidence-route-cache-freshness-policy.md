# ADR-027 — Evidence Route Cache and Freshness Policy

## Status

Proposed

## Context

ConnectIO V2 is a read-only evidence and investigation application. It surfaces Databricks-backed manufacturing evidence with source badges, freshness indicators, caveats, and truthfulness guardrails.

Caching query results at the FastAPI routing or repository level can significantly reduce Databricks query execution costs and page load latency. However, serving cached evidence introduces the risk of users acting on stale data under the false assumption that it represents real-time conditions. Stale information in a quality-assurance or product-recall context can lead to incorrect operational decisions.

To balance performance with compliance and safety, any caching layer must be tied directly to explicit freshness policies, transparent response headers, UI caveats, and strict evidence state semantics.

---

## Decision

Define a lightweight, opt-in server-side caching layer for repository-backed evidence routes. This caching layer will not be implemented until this ADR is accepted.

### 1. Cache Policy Categories (Aligned with CacheTier)

The cache policy must map directly to the backend `CacheTier` definitions. The current configuration is aligned as follows, with recommended future expansions:

- **`NONE` / `NO_CACHE`**: For decision-sensitive, safety-critical, or highly volatile evidence. Queries in this tier bypass the cache entirely and must always fetch from the live source.
- **`PER_USER_60S`** (Existing): For common evidence panels where minute-level freshness is acceptable. Cached data is isolated to a single user identity.
- **`GLOBAL_300S`** (Existing): For slow-moving reference or dimension data. Shared across all users.
- **Proposed Future Expansions**:
  - `PER_USER_30S`: For highly interactive but user-scoped views.
  - `PER_USER_300S`: For slower-changing reference summaries.
  - `SHARED_REFERENCE_1H`: For non-user-sensitive global reference data (never to be used for batch, recall, or quality decision evidence).

### 2. Cache Key Composition & Security Isolation

To prevent information leaks, unauthorized access, and cross-catalog cache pollution, all cache keys must be constructed from:

- `query_name`
- `route_name` / FastAPI endpoint
- Normalized request parameters (sorted query/body parameters)
- User identity context or per-user token boundary (excluding raw OAuth tokens)
- The resolved `catalog_target` (to prevent catalog override leakage)
- `adapter_mode`
- The relevant `CacheTier`

**Security Constraints:**

- Raw OAuth tokens or sensitive credentials must never be included in cache keys or saved in cache values.
- Cached results must never be shared across different user boundaries unless the query is explicitly classified under a global/shared reference tier.

### 3. Response Headers Specification

Any route serving cached evidence must return the following cache instrumentation headers to provide full observability to callers and UAT processes:

- `X-Cache-Status`: `HIT` | `MISS` | `BYPASS` | `STALE` | `DISABLED`
- `X-Cache-Age-Seconds`: Integer value representing seconds since the item was cached, or blank if not cached.
- `X-Cache-TTL-Seconds`: Integer value indicating the configured TTL for the cache entry, or blank if not cached.
- `X-Data-Freshness-Policy`: Identifier of the freshness policy applied (e.g., `per-user-60s`, `no-cache`, `route-default`).
- `X-Data-Source`: Existing source badge (e.g., `databricks-api`).
- `X-Query-Name`: Existing query name.
- `X-Adapter-Mode`: Existing adapter mode.

### 4. Freshness Rules

- **Visibility of Age**: Cached evidence must prominently show its age in the frontend interface using the `FreshnessIndicator`.
- **Freshness Thresholds**: Cached evidence older than the route TTL must not be returned as fresh.
- **Stale-While-Error Behaviour**: If the remote source is unavailable, stale cached evidence may only be returned if the route explicitly declares `stale-while-error` support. In this case, `X-Cache-Status` must be set to `STALE` (or `FALLBACK`), and the response must carry a clear header indicating that the system is serving stale data as a fallback.
- **Error vs Empty**: If stale data is not allowed to be served and the backend fails, the API must return the relevant Databricks error instead of returning an empty dataset.
- **Empty Result Labelling**: A cached empty result must be cached as "empty evidence" rather than being conflated with a successful check (e.g. do not show "No issue found" if it represents a cached missing record).

### 5. Truthfulness Rules & Forbidden Claims

Caching must not introduce or mask forbidden claims. The presence of a cache hit is not evidence of correctness. The caching layer and UI indicators must never imply:

- Safe, Approved, Released
- Low risk, In control
- Recall not required
- No issue found (unless confirmed empty)
- Healthy, Complete, On time, Fully contained

### 6. Repository Integration

- Caching logic belongs in a transparent wrapper around `DatabricksRepository.fetch` or the `QueryExecutor` layer.
- Individual domain adapters and FastAPI routes must remain decoupled from specific cache store implementations.
- The `QuerySpec` will carry the configured `cache_policy` and `cache_key`.
- FastAPI route helpers will extract cache metadata to populate the HTTP response headers.

### 7. Evaluation of Implementation Options

1.  **In-Memory Cache (Recommended First Step)**:
    - _Pros_: Extremely simple, zero infrastructure dependencies, appropriate for local development and single-instance Databricks App deployments.
    - _Cons_: Not shared across horizontal app instances, lost on process restart.
2.  **Redis / External Cache**:
    - _Pros_: Persistent, shared across all scaled instances.
    - _Cons_: Adds infrastructure complexity, security overhead, and connection management.
3.  **Headers-only Instrument (Baseline)**:
    - _Pros_: Extremely safe, establishes observability before caching logic.
    - _Cons_: Offers no latency or cost reduction.

**Decision**: Start with headers/freshness instrumentation and a small in-memory per-process cache only for low-risk evidence routes. Evaluate moving to Redis later if scale or performance demands it.

### 8. Candidate Routes for Initial Caching

Once this ADR is accepted, the first candidate routes for in-memory caching are:

- `POST /api/spc/chart-data` (short per-user TTL)
- `GET /api/spc/subgroups` (short per-user TTL)
- `POST /api/quality/read-only-evidence` (only if clearly labelled with freshness and scoped per-user/per-catalog)

**Excluded from Caching**:

- Warehouse 360 overview blocked Gates 4/5.
- Trace recall/containment decisioning.
- Any endpoint backing active containment or recall decisions.

### 9. UAT Guidance

- UAT evidence capture sessions must record whether responses were a cache `HIT` or `MISS`.
- Initial live UAT evidence must bypass the cache to validate source connectivity.
- Offline smoke tests do not count as live Databricks evidence.

---

## Consequences

- **Positive**: Establishes strict safety controls so caching does not compromise product quality or recall decisions.
- **Negative**: Introduces engineering overhead to manage cache key hashing, catalog isolation, and headers.
- **Neutral**: The existing `CacheTier` enum and `QuerySpec` fields are reused to drive caching parameters.
