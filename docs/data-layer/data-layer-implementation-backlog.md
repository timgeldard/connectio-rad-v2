# Data-Layer Implementation Backlog

> Generated from the cross-domain data-layer completion audit (2026-05-21).
> See [data-layer-completion-inventory.md](./data-layer-completion-inventory.md) for capability status.
> See [adapter-coverage-audit.md](./adapter-coverage-audit.md) for adapter risk details.
> See [source-verification-coverage.md](./source-verification-coverage.md) for source object gaps.

This backlog is ranked to prioritise the fastest path to controlled UAT evidence, then governance closures, then implementation slices that require Databricks access or business approval.

Items 1–2 require a deployed Databricks Apps environment with OAuth, not Databricks SQL access.
Items 3–4 require Databricks SQL access.
Items 5–10 require a combination of governance decisions and engineering work.

---

## Rank 1 — Traceability: Run browser UAT evidence capture

| Field | Value |
|---|---|
| **Domain** | Traceability |
| **Work package** | Run Traceability UAT evidence runbook against deployed app; capture filled runbook + screenshots + Copy UAT Evidence payload |
| **Why it matters** | Traceability has 6 live routes wired and 4+ source objects verified, but zero browser UAT evidence captured. This is the fastest path to meaningful UAT proof in the repo. Fills the only remaining gap between "code-ready" and "evidence-backed." |
| **Depends on** | Deployed Databricks Apps instance with `databricks-api` mode + OAuth; UAT runbook at `domain-integrations/traceability/docs/traceability-uat-evidence-runbook.md` |
| **Databricks SQL required?** | No — deployed app in databricks-api mode only |
| **Business governance required?** | No (initially) — mass balance caveats remain; UD display excluded |
| **Runtime code required?** | No — all routes already wired |
| **Expected files / routes / contracts** | No new files; update `uat-validation-ledger.md` with evidence; attach screenshots and Copy UAT Evidence payloads |
| **Acceptance criteria** | Runbook fully filled for candidate Material 20035129 / Batch 8000049668 / Plant C061; screenshots for batch header, trace graph, customer deliveries, supplier exposure, production history; mass balance caveat banner confirmed visible; Copy UAT Evidence payload captured and committed |
| **Risk if skipped** | No evidence of live Databricks correctness; cannot claim parity; DEF-TRACE-005 and TRACE-P1-010/011 uninvestigated |

---

## Rank 2 — POH: Run browser UAT evidence capture

| Field | Value |
|---|---|
| **Domain** | POH / Operations |
| **Work package** | Run POH UAT evidence runbook against deployed app; verify PR #62 fixes in live mode |
| **Why it matters** | POH has 4 live native routes (header, operations, confirmations, goods movements), PR #62 hardening (component grouping, source attribution), and 2 verified UAT candidates. Browser evidence confirms the code is correct in live Databricks mode — without it the PR #62 fixes are untested against real data. |
| **Depends on** | Deployed Databricks Apps instance with `databricks-api` mode + OAuth; runbook at `domain-integrations/operations/docs/poh-uat-evidence-runbook.md` |
| **Databricks SQL required?** | No — deployed app only |
| **Business governance required?** | No |
| **Runtime code required?** | No — routes already wired |
| **Expected files / routes / contracts** | No new files; update `golden-process-orders.md` with evidence; attach screenshots and Copy UAT Evidence payload |
| **Acceptance criteria** | Runbook filled for PO 7006965038 and/or 7006965039 / Plant C113; all 4 panels (header, operations, confirmations, goods movements) visible and non-empty; section source badges confirm `databricks-api`; Copy UAT Evidence payload captured |
| **Risk if skipped** | PR #62 source attribution fix unconfirmed in live mode; mixed live/mock issue in `legacy-api` mode undiscovered |

---

## Rank 3 — CQ Lab: Fix critical `getLabPlants()` silent mock fallback *(completed 2026-05-21 on feature/data-layer-completion-audit)*

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
| **Work package** | Implement `POST /api/quality/usage-decision` native Databricks route; wire `QualityReadOnlyEvidenceAdapter` to return real data; display per-lot UD table in Quality Evidence view |
| **Why it matters** | The source is fully verified (`gold_inspection_usage_decision`), the Zod contracts are complete, the display helpers are tested (60+ unit tests), and the Python model exists. This is the next-most-ready live implementation after POH and Traceability. |
| **Depends on** | Rank 5 (lot-selection rule confirmed); Unity Catalog grants for `gold_inspection_usage_decision` + `gold_inspection_lot`; SQL template for latest-UD-per-lot query |
| **Databricks SQL required?** | Yes — route execution |
| **Business governance required?** | Governance gate already cleared (Rank 5) |
| **Runtime code required?** | Yes |
| **Expected files / routes / contracts** | `apps/api/routes/quality.py` (new route); `domain-integrations/quality/src/adapters/quality-readonly-evidence-adapter.ts` (add live fetch); add `response_model=QualityEvidenceResponse` to route; tests for live path |
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

## Rank 10 — Warehouse: Source schema alignment (overview route prioritised)

| Field | Value |
|---|---|
| **Domain** | Warehouse360 |
| **Work package** | Verify `wh360_kpi_snapshot_v` columns in Databricks to unblock the `GET /api/warehouse360/overview` mapper rewrite; then identify source objects for the 4 other native warehouse routes. |
| **Why it matters** | The overview route mapper/contract alignment analysis (2026-05-22, `warehouse360-overview-contract-alignment.md`) confirmed that 10 of 11 non-optional contract fields cannot be safely populated without Databricks verification. The frontend adapter already expects contract shape and silently returns 0 for all counts — the mismatch is actively masking data. Verification of `wh360_kpi_snapshot_v` is the single prerequisite for the mapper rewrite. The 4 other warehouse routes are `response_model`-enforced but source objects remain unidentified (DDL unverified). |
| **Depends on** | Databricks SQL access (`DESCRIBE TABLE` on `wh360_kpi_snapshot_v`) |
| **Databricks SQL required?** | Yes |
| **Business governance required?** | No |
| **Runtime code required?** | Yes (after verification) — rewrite `map_warehouse_overview_rows` to emit contract shape; update `test_warehouse360_routes.py`; add `response_model=Warehouse360Overview` to route |
| **Expected files / routes / contracts** | `apps/api/adapters/warehouse360/warehouse360_databricks_adapter.py` (SQL + mapper); `apps/api/routes/warehouse360.py` (response_model); `apps/api/tests/routes/test_warehouse360_routes.py` (replace V1-key assertions); update `warehouse360-overview-contract-alignment.md` with DDL evidence |
| **Acceptance criteria** | `DESCRIBE TABLE wh360_kpi_snapshot_v` output documented; all 9 required count columns confirmed or gaps raised with data platform; mapper rewritten to emit `inboundDueCount`, `outboundDueCount`, `stagingOpenCount`, `nearExpiryCount`, `reconciliationExceptionCount`, `blockedStockCount`, `plantId`; `response_model=Warehouse360Overview` added; tests pass with contract-shape assertions |
| **Risk if skipped** | Overview route continues to silently return 0 for all KPI counts; frontend displays no-data state for all overview metrics; `response_model` cannot be added safely |

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
| 5 | Quality | Confirm QM UD lot-selection rule | No (governance only) | No | Yes | **P1** |
| 6 | Quality | Wire QM UD read-only per-lot route | Yes (route + adapter) | Yes | After Rank 5 | **P1** (after 5) |
| 7 | SPC | V1 legacy bridge browser verification decision | Yes (adapter) | No for bridge | Yes for native | **P2** |
| 8 | Quality | Run broader source verification pack | No (SQL only) | Yes | No | **P2** |
| 9 | Traceability | Confirm LINK_TYPE='DELIVERY' in live data | No | No (app only) | No | **P1** (part of Rank 1) |
| 10 | Warehouse | Source schema alignment (overview prioritised — see `warehouse360-overview-contract-alignment.md`) | Yes (after SQL) | Yes | No | **P3** |
| 11 | SPC | Raise data platform migrations 012 + 013 | No (platform action) | No | No | **P2** |
| 12 | EnvMon | Confirm INSPECTION_TYPE filter + browser-verify | Possibly | Yes | No | **P2** |
| 13 | Cross-domain | Add response_model to validation-gap routes | Yes (small per route) | No | No | **P2** |
| 14 | POH | Fix legacy-api adapter JSDoc comment | Yes (comment only) | No | No | **P2** |
