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

- **QM usage-decision lot-selection rule**
- **Recall recommendation rules**
- **Quality release/signoff semantics**
- **Supplier risk model**
- **Mass-balance reconciliation interpretation**
- **SPC locked-limit approval semantics**
- **Capability calculation governance**
