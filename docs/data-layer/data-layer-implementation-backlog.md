# Data-Layer Implementation Backlog

> Generated from the cross-domain data-layer completion audit (2026-05-21) and updated (2026-05-22).
> See [data-layer-completion-inventory.md](./data-layer-completion-inventory.md) for capability status.
> See [adapter-coverage-audit.md](./adapter-coverage-audit.md) for adapter risk details.
> See [source-verification-coverage.md](./source-verification-coverage.md) for source object gaps.

This backlog separates UAT-blocked work from non-UAT hardening. Browser UAT evidence cannot currently be gathered. The programme should not stall, but it also must not pretend browser UAT has happened.

## Work that can progress without browser UAT

### 1. Main CI / formatting stabilisation
- Fix any remaining format check failures.
- Do not continue feature work while main is CI-red.
- No Databricks access required.
- No browser UAT required.

### 2. Trace App backend route and mapper hardening tests
**Purpose:**
Add or extend backend tests for Trace App routes and mappers without requiring browser UAT.

**Target areas:**
- recall-readiness mapper
- supplier-batches mapper
- batch-quality-passport mapper
- mass-balance-ledger mapper
- holds-ledger mapper
- investigation-timeline mapper

**Acceptance criteria:**
- no recall decision emitted
- recommendationStatus remains `not-evaluated`
- delivery rows remain `delivery-evidence`, not `delivered`
- supplier risk remains `unknown` unless source-backed
- no UOM defaults to KG
- no unsourced Release decision / Group QA placeholder rows
- quality status remains heuristic
- mass-balance reconciliation remains application-derived / heuristic
- response_model contracts still pass

*No Databricks SQL required. No browser UAT required.*

### 3. Warehouse360 source/route repair
**Purpose:**
Repair known native route/source mismatches.

**Known issues:**
- inbound SQL column mismatch
- staging source view mismatch
- exceptions source view mismatch
- overview mapper/contract mismatch

**Classify carefully:**
- First code/test planning can progress without browser UAT.
- Final route verification requires Databricks SQL access.
- Overview rewrite requires business rules for near-expiry and reconciliation exception definitions.

*Do not claim Warehouse360 UAT readiness.*

### 4. QM usage-decision lot-selection decision record
**Purpose:**
Prepare governance decision record for multiple inspection lots per material/batch/plant.

**Question:**
When multiple inspection lots exist, which lot or lots are authoritative for read-only evidence display?

**Options to document:**
- latest lot by created/decision date
- all lots shown per-lot with no single authoritative rollup
- usage-decision-counter based selection
- plant/material/batch scoped lot fan-out
- no rollup until QM process owner confirms

**Acceptance criteria:**
- decision options documented
- recommendation proposed
- implementation consequence documented
- no code wiring until business owner confirms

*No browser UAT required. Databricks SQL may not be required if existing source/grain docs are sufficient.*

### 5. Quality broader source-verification pack
**Purpose:**
Prepare or complete source-verification docs for:
- inspection lots
- MIC results
- CoA-like results
- deviations/notifications

**Classify:**
- query pack preparation does not require Databricks access
- execution does require Databricks SQL access
- no live route wiring until verified

### 6. SPC native frontend adapter preparation
**Purpose:**
Prepare adapter/UI wiring plan for native subgroup route without claiming UAT.

**Guardrails:**
- no Cp/Cpk/Pp/Ppk
- no stored Nelson flags
- no locked limits
- no “in control” claim
- no production readiness
- browser UAT pending

*This can progress as design/test scaffolding, but final evidence requires browser UAT.*

### 7. Contract-route coverage cleanup
**Purpose:**
Ensure the matrix reflects actual main after PRs #75–#78.

**Acceptance:**
- `GET /api/spc/subgroups` is no longer described as absent.
- Trace App routes are shown as code-fixed but browser-UAT-pending.
- Quality read-only evidence remains skeleton/unavailable.
- Warehouse360 overview remains blocked.
- EnvMon remains contract-bound but browser-UAT-pending unless evidence exists.

---

## Blocked until browser UAT access

- **Traceability browser evidence capture:** code may exist, source may be verified, browser evidence not captured, production readiness not claimed
- **POH browser evidence capture:** code may exist, source may be verified, browser evidence not captured, production readiness not claimed
- **SPC subgroup browser evidence:** code may exist, source may be verified, browser evidence not captured, production readiness not claimed
- **EnvMon browser evidence:** code may exist, source may be verified, browser evidence not captured, production readiness not claimed
- **Trace App full workspace browser evidence:** code may exist, source may be verified, browser evidence not captured, production readiness not claimed

---

## Requires Databricks SQL access

- **Trace mass-balance semantic closure:** MOVEMENT_CATEGORY direction and BALANCE_QTY
- **Warehouse360 route repair final verification**
- **Quality broader source verification execution**
- **EnvMon INSPECTION_TYPE confirmation**
- **SPC advanced semantic object verification if new routes are planned**

---

## Requires business/governance decision

| Field | Value |
|---|---|
| **Domain** | Quality (Connected Quality Lab) |
| **Work package** | Fix catch block in `connected-quality-lab-legacy-api-adapter.ts` that silently falls back to `super.getLabPlants()` on any exception |
| **Why it matters** | This is the only confirmed CRITICAL adapter risk in the codebase. When the V1 CQ Lab endpoint is unavailable, users see mock plant data with no source badge, no error state, and no caveat. This is a direct violation of the UX truthfulness rules. |
| **Depends on** | Nothing — standalone code fix |
| **Databricks SQL required?** | No |
| **Business governance required?** | No |
| **Runtime code required?** | Yes — small fix |
| **Expected files / routes / contracts** | `domain-integrations/quality/src/adapters/connected-quality-lab-legacy-api-adapter.ts` (1 catch block); add/update test case for `getLabPlants()` error path in `connected-quality-lab-legacy-api-adapter.test.ts` |
| **Acceptance criteria** | `getLabPlants()` catch block returns `{ ok: false, error: {...}, displayState: 'error', source: 'legacy-api' }`; test added confirming error state returned on network failure; no mock plant data returned silently |
| **Risk if skipped** | CRITICAL: users see mock plants as real in legacy-api mode; no indication of failure |

---

## Rank 4 — Traceability: Resolve mass balance semantic gaps (TRACE-P1-010 and TRACE-P1-011)

| Field | Value |
|---|---|
| **Domain** | Traceability |
| **Work package** | Governance resolution: get data platform + business confirmation on MOVEMENT_CATEGORY → direction mapping and BALANCE_QTY semantics |
| **Why it matters** | Mass balance is the highest-value traceability capability for supply chain incident response. Currently the panel has mandatory caveats that cannot be removed until direction mapping and running-balance semantics are confirmed. Resolving these two items closes TRACE-P1-010 and TRACE-P1-011 and unblocks the mass balance panel from showing meaningful data. |
| **Depends on** | Data platform engineer (BALANCE_QTY semantics); business/data-platform owner (MOVEMENT_CATEGORY direction); Databricks SQL access for BALANCE_QTY spot-check across multiple batches |
| **Databricks SQL required?** | Yes — BALANCE_QTY spot-check; optional for direction mapping (governance first) |
| **Business governance required?** | Yes — movement category direction assignment |
| **Runtime code required?** | Yes (after governance) — update `_MOVEMENT_CATEGORY_MAP` in the route; remove or update caveat banners |
| **Expected files / routes / contracts** | `apps/api/routes/trace2.py` (MOVEMENT_CATEGORY map update); `domain-integrations/traceability/docs/mass-balance-semantic-validation-pack.md` (fill approval table); caveat banner update in frontend |
| **Acceptance criteria** | MOVEMENT_CATEGORY direction table filled + business-approved; BALANCE_QTY semantics documented; TRACE-P1-010 and TRACE-P1-011 both closed; mass balance panel shows directional data without generic caveat |
| **Risk if skipped** | Mass balance caveat banners cannot be removed; panel data untrusted indefinitely |

---

## Rank 5 — Quality: Confirm QM UD lot-selection rule (TRACE-P1-012)

| Field | Value |
|---|---|
| **Domain** | Quality, Traceability |
| **Work package** | Kerry QM process owner confirms which inspection lot is authoritative when multiple lots exist per batch |
| **Why it matters** | This governance decision unblocks both the Quality read-only UD display AND the quality_status field on the Traceability batch header. It is the single governance gate that blocks two separate live wiring tasks (rank 6 below). |
| **Depends on** | Kerry QM process owner availability; no code required |
| **Databricks SQL required?** | No |
| **Business governance required?** | Yes — QM process owner |
| **Runtime code required?** | No — governance only |
| **Expected files / routes / contracts** | Update `domain-integrations/quality/docs/qm-usage-decision-runtime-implementation-plan.md` §6 with written confirmation; update TRACE-P1-012 to closed |
| **Acceptance criteria** | Written confirmation from Kerry QM process owner; lot-selection rule documented in implementation plan; go issued for per-lot UD display |
| **Risk if skipped** | QM UD route cannot be wired; quality_status on batch header cannot be populated; Quality evidence remains unavailable-state indefinitely |

---

## Rank 6 — Quality: Wire QM UD read-only per-lot route (after Rank 5)

| Field | Value |
|---|---|
| **Domain** | Quality, Traceability |
| **Work package** | Replace `POST /api/quality/read-only-evidence` unavailable skeleton with verified QM UD query; update `QualityReadOnlyEvidenceApiAdapter` to map live rows; display per-lot UD table in Quality Evidence view |
| **Why it matters** | The API skeleton and contracts are in place, but they return an explicit unavailable state. Replacing the skeleton body with the verified UD query completes the vertical slice. |
| **Prerequisites** | Rank 5 (QM UD lot-selection rule confirmed) |
| **Effort** | Medium (backend query + frontend mapping) |
| **Expected files / routes / contracts** | `apps/api/routes/quality.py` (update route body); `domain-integrations/quality/src/adapters/quality-readonly-evidence-api-adapter.ts` (update to expect live data); tests for live path |
| **Acceptance criteria** | Route returns real per-lot UD data; frontend displays governed UD labels (never "Released"/"Approved"); source badge shows `databricks-api`; unavailable state shown if no lots found; test coverage for success + no-record + error paths |
| **Risk if skipped** | UD evidence remains mock/unavailable; Quality panel stays in `pending-source-verification` state indefinitely |

---

## Rank 7 — SPC: V1 legacy bridge browser verification decision

| Field | Value |
|---|---|
| **Domain** | SPC |
| **Work package** | Confirm V1 SPC app URL in UAT environment; browser-verify the 5 existing V1 proxy routes (`/api/spc/materials`, `/plants`, `/characteristics`, `/capability`, `/chart-data`); decide whether to proceed with legacy bridge or native route |
| **Why it matters** | SPC has 5 V1 proxy routes wired but none are browser-verified. The contract alignment is complete (PR #67). The fastest UAT path is V1 bridge verification. The native route is cleaner long-term but has governance prerequisites (signal computation decision, plant namespace, missing migrations 012/013). Both paths need a decision before SPC can advance. |
| **Depends on** | V1 SPC app URL confirmation; deployed environment with V1 legacy-api access |
| **Databricks SQL required?** | No for bridge verification; Yes for native route |
| **Business governance required?** | Yes for native: signal calculation approach + backend capability + plant namespace mapping; No for legacy bridge |
| **Runtime code required?** | Yes — implement `SPCMonitoringLegacyApiAdapter` fully (currently only 3 methods overridden; navigation and context still fall to mock) |
| **Expected files / routes / contracts** | `domain-integrations/spc/src/adapters/spc-monitoring-legacy-api-adapter.ts` (fill remaining methods); browser-verify all 5 routes; update `spc-native-migration-readiness-checklist.md` |
| **Acceptance criteria** | All 5 V1 proxy routes browser-verified; full SPC cockpit navigable in legacy-api mode; golden candidate Candidate 1 (Material 20047111 / Plant C037 / MIC 0060) renders real control chart data; Copy SPC UAT Evidence payload captured |
| **Risk if skipped** | SPC stays mock-only; V1 legacy bridge goes unverified; no UAT evidence path for SPC |

---

## Rank 8 — Quality: Run broader source verification pack

| Field | Value |
|---|---|
| **Domain** | Quality |
| **Work package** | Execute the Quality broader source verification pack (`quality-databricks-source-verification.md`) — DESCRIBE TABLE on inspection lot, MIC result objects, CoA-like objects, deviation/notification objects |
| **Why it matters** | The verification pack is ready. The Quality read-only evidence contracts exist for inspection lot, MIC results, CoA results, and deviations — but no source DDL has been verified for 3 of the 4 types. Executing the pack unblocks source-verification-pending status for the broader Quality evidence layer. |
| **Depends on** | Databricks SQL access to connected_plant_uat.gold |
| **Databricks SQL required?** | Yes |
| **Business governance required?** | No |
| **Runtime code required?** | No (verification only) |
| **Expected files / routes / contracts** | Fill evidence tables in `domain-integrations/quality/docs/quality-databricks-source-verification.md`; update `golden-quality-candidates.md` with confirmed candidate |
| **Acceptance criteria** | DESCRIBE TABLE results for `gold_inspection_lot`, `gold_batch_quality_result_v`, and any CoA/deviation objects documented; schema comparison against Zod contracts; grain confirmed or gap documented |
| **Risk if skipped** | Quality read-only MIC/CoA/deviation display cannot be safely wired; column names and grain unknown |

---

## Rank 9 — Traceability / POH: Confirm LINK_TYPE='DELIVERY' in live data

| Field | Value |
|---|---|
| **Domain** | Traceability |
| **Work package** | Run CE-4 UAT scenario to confirm LINK_TYPE='DELIVERY' value exists in live `gold_batch_lineage` rows |
| **Why it matters** | The customer exposure route filters on `LINK_TYPE='DELIVERY'`. The value was inferred from V1 code inspection with medium confidence — it has not been confirmed in live data. If the value is wrong, the customer exposure route always returns zero rows (which it silently treats as no-exposure). |
| **Depends on** | Rank 1 (Traceability UAT runbook includes this scenario); deployed environment |
| **Databricks SQL required?** | No — browser UAT scenario is sufficient; direct SQL optional for faster confirmation |
| **Business governance required?** | No |
| **Runtime code required?** | No |
| **Expected files / routes / contracts** | Update `domain-integrations/traceability/docs/uat-validation-ledger.md` (CE-4 row); close DEF-TRACE-005 |
| **Acceptance criteria** | Customer exposure panel returns non-zero rows for a batch with known deliveries; OR explicit empty-exposure case confirmed with correct disclaimer message |
| **Risk if skipped** | Customer exposure route may be silently filtering out all data; zero-exposure mistakenly treated as confirmed containment |

---

## Rank 10 — Warehouse: Fix production-broken WH360 native routes (ELEVATED — DDL verified 2026-05-22)

| Field | Value |
|---|---|
| **Domain** | Warehouse360 |
| **Work package** | Fix 3 production-broken WH360 native routes (wrong column names / missing views) and then implement the overview mapper rewrite. |
| **Why it matters** | Live Databricks verification (2026-05-22, `warehouse360-overview-contract-alignment.md`) confirmed that 3 of 4 `response_model`-enforced warehouse routes fail in production: (1) inbound adapter SQL references non-existent column names (`DOCUMENT_TYPE`, `PURCHASE_ORDER_ID`, `WAREHOUSE_NUMBER` vs actual `doc_type`, `po_id`, no `warehouse_number`); (2) staging route references `staging_orders_v` which does not exist; (3) exceptions route references `wh360_imwm_exceptions_v` which does not exist (correct name: `imwm_exceptions_v`). These routes pass unit tests because tests mock Databricks — they have never been verified against real data. The overview route additionally has a mapper/contract shape gap (all 9 count fields return 0). |
| **Depends on** | Data platform team to confirm intended schema and fix view names/column names (items 1–3 above); business confirmation for near-expiry threshold and reconciliation exception type (items 4–5 in `warehouse360-overview-contract-alignment.md`) |
| **Databricks SQL required?** | Already done (DDL verified). Further access needed for testing after fixes. |
| **Business governance required?** | Yes — near-expiry threshold; reconciliation exception type filter |
| **Runtime code required?** | Yes — fix adapter SQL for inbound (column name rewrite); fix adapter SQL for staging (use `wh360_process_orders_v` or new view); fix adapter SQL for exceptions (rename to `imwm_exceptions_v`); rewrite overview mapper to use multi-view subqueries emitting contract shape; add `response_model=Warehouse360Overview`; update tests |
| **Expected files / routes / contracts** | `apps/api/adapters/warehouse360/warehouse360_databricks_adapter.py` (4 SQL rewrites + new overview subquery SQL); `apps/api/routes/warehouse360.py` (`response_model`); `apps/api/tests/routes/test_warehouse360_routes.py` (update all assertions); `apps/api/tests/adapters/warehouse360/test_warehouse360_adapter.py` |
| **Acceptance criteria** | All 4 adapter SQLs run successfully against `connected_plant_uat`; inbound/outbound/staging/exceptions return real rows; overview returns `inboundDueCount`, `outboundDueCount`, `stagingOpenCount`, `nearExpiryCount`, `reconciliationExceptionCount`, `blockedStockCount`, `plantId`; `response_model=Warehouse360Overview` added; all tests pass |
| **Risk if skipped** | All 5 WH360 native routes fail silently or with 500 errors in production; frontend displays no data or cached errors; `response_model` enforcement provides false safety on broken routes |

---

## Rank 11 — SPC: Raise data platform migrations 012 and 013

| Field | Value |
|---|---|
| **Domain** | SPC |
| **Work package** | Raise with the Kerry data platform team to apply migration 012 (`spc_nelson_rule_flags_mv`) and migration 013 (`spc_capability_detail_mv`) in connected_plant_uat.gold |
| **Why it matters** | These two objects are NOT FOUND in UAT (confirmed by PR #65 verification pack). Without them, SPC rule signals and capability indices cannot be displayed from Databricks — the panels are permanently mock. This is a data platform action, not a V2 engineering action. |
| **Depends on** | Data platform team availability |
| **Databricks SQL required?** | No — data platform action |
| **Business governance required?** | No |
| **Runtime code required?** | No (until migrations applied) |
| **Expected files / routes / contracts** | Ticket / communication to data platform; update `spc-databricks-verification-results-summary.md` when applied |
| **Acceptance criteria** | Both objects visible in `SHOW TABLES IN connected_plant_uat.gold`; DESCRIBE TABLE output documented |
| **Risk if skipped** | SPC capability indices permanently mock; SPC rule signals permanently mock; 2 of 10 SPC capabilities blocked |

---

## Rank 12 — EnvMon: Confirm INSPECTION_TYPE filter values and browser-verify routes

| Field | Value |
|---|---|
| **Domain** | EnvMon |
| **Work package** | Confirm INSPECTION_TYPE filter values '14' and 'Z14' exist in UAT `gold_inspection_lot` data; browser-verify GET /api/envmon/site-summary and GET /api/envmon/swab-results |
| **Why it matters** | Both EnvMon routes are wired with native Databricks queries, but the INSPECTION_TYPE filter values have not been confirmed in UAT data. If the values differ, both routes return empty results silently. |
| **Depends on** | Deployed environment OR Databricks SQL access to spot-check INSPECTION_TYPE values |
| **Databricks SQL required?** | Yes for direct confirmation; OR browser UAT against a plant with known swab data |
| **Business governance required?** | No |
| **Runtime code required?** | Possibly — if filter values are wrong, update route SQL |
| **Expected files / routes / contracts** | `apps/api/routes/envmon.py` (update INSPECTION_TYPE filter if wrong); update source verification coverage |
| **Acceptance criteria** | INSPECTION_TYPE values confirmed in UAT data; site-summary and swab-results return non-empty responses for a known plant |
| **Risk if skipped** | Both EnvMon routes may return empty results silently; no signal to user |

---

## Rank 13 — Add `response_model` to routes missing backend validation *(partially complete 2026-05-22)*

| Field | Value |
|---|---|
| **Domain** | Cross-domain |
| **Work package** | Add `response_model` declarations to routes that are missing backend validation. See `docs/data-layer/backend-contract-enforcement-plan.md` for full decision table. |
| **Why it matters** | Without `response_model`, FastAPI does not validate the response shape before sending. If a source object changes (column rename, type change), the API silently returns malformed data. Backend validation is a safety net. |
| **Status** | **Partially complete (2026-05-22, branches `feature/backend-contract-enforcement` + `feature/envmon-swab-contract-alignment`).** Enforced: `GET /envmon/site-summary` (EnvMonSiteSummary), `GET /envmon/swab-results` (EnvMonNativeSwabResult), `GET /warehouse360/{inbound,outbound,staging,exceptions}` (4 models). Skipped with documented reasons: `/trace2/batch-header` (proxy-passthrough), `/por/order-header` (proxy-passthrough + mapper mismatch), `/warehouse360/overview` (mapper shape gap — analysis complete, see `warehouse360-overview-contract-alignment.md`), `/cq/lab/fails` (proxy-passthrough), `/cq/lab/plants` (proxy-passthrough). |
| **Remaining work** | Fix mapper for `/por/order-header` (remove `inspectionLotId`); rewrite `/warehouse360/overview` mapper to contract shape after Databricks verification of `wh360_kpi_snapshot_v` columns (see Rank 10); browser-verify V1 proxy paths before enforcing `/trace2/batch-header`, `/cq/lab/*` |
| **Databricks SQL required?** | No |
| **Business governance required?** | No |
| **Runtime code required?** | Yes — mapper fixes per route |
| **Expected files / routes / contracts** | `apps/api/adapters/poh/poh_databricks_adapter.py`, `apps/api/adapters/warehouse360/warehouse360_databricks_adapter.py` |
| **Acceptance criteria** | All remaining routes enforced; all route tests pass; no silent contract drift possible |
| **Risk if skipped** | Silent data shape mismatches undetected for remaining 5 routes; contract drift between Zod and Python undetected |

---

## Rank 14 — Fix POH legacy-api adapter JSDoc comment (HIGH adapter risk)

| Field | Value |
|---|---|
| **Domain** | POH |
| **Work package** | Correct the misleading JSDoc comment in `process-order-review-legacy-api-adapter.ts` that says "Falls back to mock on any error until verified" when the code actually returns an error AdapterResult |
| **Why it matters** | The comment misleads future developers into thinking mock data is silently returned on failure. This is a code-quality and safety documentation issue. |
| **Depends on** | Nothing |
| **Databricks SQL required?** | No |
| **Business governance required?** | No |
| **Runtime code required?** | Yes — 1 comment change |
| **Expected files / routes / contracts** | `domain-integrations/operations/src/adapters/process-order-review-legacy-api-adapter.ts` (JSDoc update) |
| **Acceptance criteria** | Comment accurately describes error-path behavior; no other behavior changed |
| **Risk if skipped** | Developer confusion; future changes may incorrectly add mock fallback believing it's established pattern |

---

## Deferred — Shell-wide Genie assistant

Shell-wide Genie remains deferred until:
1. POH and Traceability deterministic pilots are browser-validated against live evidence (Ranks 1–2)
2. Domain evidence packs show live-validated correctness
3. Shell-wide scope, safety rules, and governed domains are defined

No timeline estimated. Do not wire shell-wide assistant before these gates.

---

## Summary matrix

| Rank | Domain | Work package | Dev work | Databricks SQL | Business governance | Priority |
|---|---|---|---|---|---|---|
| 1 | Traceability | Browser UAT evidence capture | No (runbook only) | No (app only) | No | **P0** |
| 2 | POH | Browser UAT evidence capture | No (runbook only) | No (app only) | No | **P0** |
| 3 | Quality | Fix CQ Lab getLabPlants() CRITICAL fallback | Yes (small fix) | No | No | **P0** |
| 4 | Traceability | Mass balance semantic closure | No (governance); Yes (after) | Optional | Yes | **P1** |
| 5 | Quality | Confirm QM UD lot-selection rule | No | No | **Done (Option A)** | **Complete** |
| 6 | Quality | Wire QM UD read-only per-lot route | Yes (route + adapter) | Yes | **Done** | **Complete** |
| 7 | SPC | V1 legacy bridge browser verification decision | Yes (adapter) | No for bridge | Yes for native | **P2** |
| 8 | Quality | Run broader source verification pack | No (SQL only) | Yes | No | **P2** |
| 9 | Traceability | Confirm LINK_TYPE='DELIVERY' in live data | No | No (app only) | No | **P1** (part of Rank 1) |
| 10 | Warehouse | Fix production-broken WH360 routes + overview mapper rewrite (see `warehouse360-overview-contract-alignment.md`) | Yes | Done (needs follow-up) | Yes (near-expiry + exception type) | **P2** (elevated — routes confirmed broken in prod) |
| 11 | SPC | Raise data platform migrations 012 + 013 | No (platform action) | No | No | **P2** |
| 12 | EnvMon | Confirm INSPECTION_TYPE filter + browser-verify | Possibly | Yes | No | **P2** |
| 13 | Cross-domain | Add response_model to validation-gap routes | Yes (small per route) | No | No | **P2** |
| 14 | POH | Fix legacy-api adapter JSDoc comment | Yes (comment only) | No | No | **Complete** |
