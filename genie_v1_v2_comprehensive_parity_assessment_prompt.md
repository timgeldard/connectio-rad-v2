# Comprehensive V1 Genie Usage Discovery and V2 Genie Parity Roadmap

## Repositories

**V1 repo:**  
<https://github.com/timgeldard/ConnectIO-RAD>

**V2 repo:**  
<https://github.com/timgeldard/connectio-rad-v2>

Branch from latest V2 `main`.

Suggested branch name:

```text
feature/genie-v1-v2-comprehensive-parity-assessment
```

Agent:

```text
GitHub Copilot
```

## Work package

**Comprehensive V1 Genie Usage Discovery and V2 Genie Parity Roadmap**

## Context

ConnectIO RAD V2 is being rebuilt as a workspace-first manufacturing intelligence platform. It is moving away from isolated V1 apps into domain integrations, shared evidence panels, Databricks-native adapters, source truthfulness patterns, and UAT evidence capture.

The main V2 domains are:

- Traceability
- Process Order History / POH
- SPC
- Warehouse360
- Quality Batch Release
- Cross-domain workspace runtime

Recent V2 work has added or improved:

- Databricks-native adapter patterns
- Zod to Pydantic contract sync
- source badges and evidence-status UX
- UAT evidence copy payloads
- partial/unavailable/no-record semantics
- live Databricks Traceability batch header and trace graph paths
- Traceability customer exposure and delivery evidence slices
- POH native Databricks routes
- SPC V1 source discovery and migration planning
- cross-domain workspace context runtime behind feature flag
- domain readiness ledgers and production-readiness checklists

The next question is whether V1’s Databricks Genie / AI-BI / natural-language analytics capability has been properly understood and whether V2 has a clear parity roadmap.

Known current observation:

V1 Process Order History appears to contain Genie artefacts such as:

- `apps/processorderhistory/genie/instructions/03_table_rules.md`
- `apps/processorderhistory/genie/joins/joins.yaml`

However, the scope must not be limited to those known files. V1 may contain explicit Genie folders, Genie-adjacent semantic assets, sample questions, Databricks Metric Views, query packs, natural-language analytics docs, assistant prompts, dashboard support files, or frontend/backend “ask/chat/assistant” functionality.

## Primary objective

Perform a comprehensive V1 repo-wide deep dive into all Genie and Genie-adjacent functionality, then produce a V2 parity roadmap aligned to the current V2 architecture.

This is mainly a discovery, assessment, and documentation tranche.

Do not implement live Genie integration.  
Do not create Databricks Genie spaces.  
Do not invent Databricks columns, joins, metrics, prompts, sample answers, or source semantics.  
Do not claim production readiness.  
Do not bypass the V2 source-truthfulness model.

The output should allow future agents and developers to answer:

1. Where is Genie used explicitly in V1?
2. Where are Genie-adjacent semantic/question/query assets used in V1?
3. Which V1 domains have no Genie coverage?
4. Which V1 Genie or Genie-adjacent assets should be carried forward into V2?
5. Which V1 assets are unsafe, incomplete, or outdated for V2?
6. What must V2 add to achieve Genie parity while preserving source truthfulness?
7. What should be blocked from Genie until UAT/live source validation is complete?

## Hard boundaries

Do not:

- create live Databricks Genie spaces
- modify Databricks workspace configuration
- add Databricks SQL or new views
- invent source columns
- invent joins
- invent metrics
- invent sample answers
- claim Genie production readiness
- add customer exposure, supplier exposure, quality decision, SPC, or warehouse calculations
- add write-back
- add SAP actions
- add quality release decisions
- add e-signature
- add app-side plant authorization
- remove source-truthfulness warnings
- make mock/unavailable data look live
- change application runtime logic unless a tiny documentation link is needed
- touch business logic in Traceability, POH, SPC, Warehouse, or Quality

Allowed changes:

- Add V2 documentation.
- Add source inventory docs.
- Add V1 to V2 parity/gap matrices.
- Add proposed Genie readiness packs.
- Add sample question lists.
- Add safe-answer guardrails.
- Add domain-specific Genie readiness docs.
- Add links from readiness index / README / domain READMEs if appropriate.

## Important V2 truthfulness principles

All Genie readiness work must align with these rules:

- Unknown is not zero.
- No records returned is not proof of absence.
- Mock is not live.
- Query time is not source freshness.
- No SPC signal returned is not “in control.”
- No delivery row returned is not “no customer exposure.”
- Missing quality decision is not “accepted.”
- Unavailable evidence must be explicitly labelled unavailable.
- Genie must be an evidence assistant, not a decision authority.
- Genie must not recommend recall closure, batch release, QA approval, SAP posting, or regulatory decisions.

---

## Expanded V1 Scope — Comprehensive Genie Usage Discovery

The scope is to capture all use of Genie and Genie-adjacent functionality across V1, not only files in folders named `genie`.

Do a comprehensive V1 repo-wide discovery of anything related to:

1. Databricks Genie / AI-BI Genie spaces
2. Databricks AI/BI dashboards or semantic assets
3. Databricks Metric Views
4. Semantic model definitions
5. Natural-language question packs
6. Sample questions / golden questions
7. Assistant prompts or agent instructions
8. Table rules
9. Join rules
10. Expressions / calculations
11. Query packs intended for Genie or business self-service
12. Docs that explain how business users should ask questions
13. Backend or frontend code that calls a Genie/assistant endpoint
14. UI features that expose “ask”, “chat”, “assistant”, “insights”, or “genie” behaviour
15. Generated SQL, prompt-to-SQL, or text-to-query workflows
16. Domain-specific prompt/context files used to configure LLM/Genie behaviour
17. Data dictionaries or glossary files intended for natural-language analytics
18. Databricks workspace configuration references for Genie, AI/BI, dashboards, or semantic layers

Do not assume V1 Genie usage is limited to `apps/*/genie/**`.

Search the entire V1 repo.

For every V1 artefact found, classify it as one of:

- explicit Databricks Genie configuration
- AI/BI or Metric View asset
- semantic model / business glossary
- table rules
- join rules
- expression/calculation rules
- sample questions
- query pack
- assistant prompt
- LLM/agent instruction
- frontend assistant/chat/ask UI
- backend assistant/chat/ask API
- Databricks dashboard/semantic support file
- domain documentation that supports natural-language analytics
- ordinary app documentation that indirectly helps Genie
- unknown but potentially Genie-related

Search terms must include, but are not limited to:

- genie
- databricks genie
- ai bi
- ai/bi
- ai_bi
- assistant
- copilot
- chatbot
- chat
- ask
- natural language
- nlq
- text to sql
- text-to-sql
- prompt
- system prompt
- instructions
- agent
- semantic
- semantic model
- metric view
- metrics
- business glossary
- glossary
- table rules
- table_rules
- joins
- joins.yaml
- expressions
- calculations
- sample questions
- golden questions
- query examples
- suggested questions
- self service
- self-service
- dashboard
- databricks dashboard
- genie space
- workspace
- SQL warehouse
- query pack
- question bank
- data dictionary
- business definitions
- domain model
- yaml
- yml
- markdown instructions

Also search by likely file/folder names:

- genie
- ai-bi
- aibi
- assistant
- semantic
- metrics
- metric_views
- prompts
- instructions
- questions
- sample_questions
- golden_questions
- joins
- expressions
- glossary
- dictionary
- databricks
- dashboards
- queries
- sql

Domains/apps to check in V1 include at minimum:

- Process Order History / POH
- Traceability
- SPC
- Warehouse / WM / staging
- Quality / Batch Release / QM
- Environmental Monitoring, if present
- Planning / scheduling, if present
- Common/shared/platform areas
- Any Databricks or analytics folders outside app folders

For each V1 domain, explicitly report:

| V1 Domain / App | Explicit Genie Assets Found? | Genie-Adjacent Assets Found? | Files Inspected | Purpose | Business Questions Supported | Data Sources | Gaps / Risks |
|---|---|---|---|---|---|---|---|

If no Genie or Genie-adjacent assets are found for a domain, state:

> No explicit or Genie-adjacent V1 assets found after repo-wide search.

and list the search locations/terms that support that conclusion.

Do not overstate findings. Distinguish clearly between:

- true Databricks Genie configuration
- general Databricks dashboard/semantic material
- application query documentation
- LLM/agent prompt material
- ordinary app documentation that only indirectly helps Genie

---

## V2 files and folders to inspect

- `README.md`
- `docs/readiness/domain-readiness-index.md`
- `docs/adapters/mock-legacy-databricks-modes.md`
- `docs/readiness/ux-truthfulness-checklist.md`
- `docs/architecture/**`
- `packages/workspace-runtime/**`
- `packages/evidence-panel-runtime/**`
- `packages/data-contracts/src/**`
- `domain-integrations/traceability/README.md`
- `domain-integrations/traceability/docs/**`
- `domain-integrations/operations/README.md`
- `domain-integrations/operations/docs/**`
- `domain-integrations/spc/README.md`
- `domain-integrations/spc/docs/**`
- `domain-integrations/warehouse/README.md`
- `domain-integrations/warehouse/docs/**`
- `domain-integrations/quality/README.md`
- `domain-integrations/quality/docs/**`
- any existing V2 files mentioning Genie, AI/BI, semantic model, sample questions, joins, assistant, or natural-language analytics

---

## Scope A — Repo-wide V1 Genie inventory

Find and document every V1 Genie or Genie-adjacent artefact.

For each artefact, capture:

- file path
- domain/app
- artefact type
- purpose
- format
- key content
- source tables/views referenced
- joins referenced
- expressions/calculations referenced
- sample questions referenced
- whether it is explicit Genie or only Genie-adjacent
- whether it appears safe to carry forward into V2
- risks or missing guardrails

Create an artefact inventory table:

| V1 Artefact | File Path | Domain | Classification | Purpose | Data Sources | Questions/Rules Covered | V2 Relevance | Risk |
|---|---|---|---|---|---|---|---|---|

Acceptance:

- V1 Genie artefacts are listed with file paths.
- Genie-adjacent artefacts are listed separately or clearly classified.
- If a domain has no relevant artefacts, this is explicitly stated with search evidence.
- No assumptions are made without file/path evidence.

---

## Scope B — Deep dive V1 Genie by domain

Assess V1 Genie coverage for:

1. Process Order History / POH
2. Traceability
3. SPC
4. Warehouse / WM / staging
5. Quality / Batch Release / QM
6. Environmental Monitoring, if present
7. Planning / scheduling, if present
8. Cross-domain / common / platform-level Genie assets

For each domain, document:

### Functional coverage

- What business questions does the Genie/Genie-adjacent material support?
- Does it support operational summary?
- Does it support process order status/history?
- Does it support production phases?
- Does it support confirmations?
- Does it support goods movements?
- Does it support component consumption?
- Does it support produced output?
- Does it support yield?
- Does it support quality results?
- Does it support SPC trends?
- Does it support traceability/batch lineage?
- Does it support customer or supplier exposure?
- Does it support warehouse staging or stock?
- Does it support batch release?
- Does it support exceptions, downtime, or issues?

### Source coverage

- approved tables/views
- joins
- filters
- date handling
- key fields
- source grain
- row-level vs aggregate data
- metrics / metric views
- freshness references, if any
- source limitations, if any

### Risks

- ambiguous joins
- missing grain definitions
- missing source freshness
- no no-record warning
- no exposure caveat
- no quality/release caveat
- no plant/security caveat
- no distinction between control limits and specification limits
- no distinction between stored signals and calculated signals
- no UAT evidence pattern
- statements that could overclaim safety, containment, release, or completion

Acceptance:

- Each domain has a V1 Genie coverage summary.
- Unknowns are explicitly labelled.
- Risks are mapped to V2 source-truthfulness principles.

---

## Scope C — Compare V1 Genie to V2 architecture

V2 architecture is workspace-first and evidence-panel based. Genie parity must align with that.

Compare V1 Genie concepts to V2 architectural concepts:

| V1 Genie Concept | V1 Artefact / Source | V2 Equivalent | V2 Gap | Recommended Action |
|---|---|---|---|---|

Consider these V2 architecture elements:

- domain integrations
- evidence panels
- workspace runtime
- active investigation context
- data contracts
- source adapters
- Databricks-native QuerySpec routes
- source/freshness badges
- copy UAT evidence
- partial-data notices
- readiness ledgers
- UX truthfulness checklist

Answer these questions:

- Should Genie be configured per domain or cross-domain workspace?
- Should Genie use the same gold views as V2 app routes?
- Should Genie avoid certain views until validated?
- Should Genie use app-serving views rather than raw gold views?
- How should Genie understand workspace context such as materialId, batchId, plantId, processOrderId, micId?
- How should Genie avoid contradicting app evidence panels?
- Should Genie output include source confidence / freshness language?
- What is the relationship between Genie questions and V2 UAT evidence payloads?
- How should V2 prevent Genie from giving operational or regulatory decisions?

Acceptance:

- V1 Genie is mapped to V2 architecture.
- Proposed parity approach does not bypass the V2 source-truthfulness model.
- The output distinguishes “Genie as evidence assistant” from “Genie as decision authority.”

---

## Scope D — Traceability Genie readiness assessment

Traceability is the highest-risk domain. Create a deep assessment for Traceability Genie readiness even if V1 has no direct Traceability Genie artefacts.

Assess approved/candidate Traceability sources:

- `gold_batch_summary_v`
- `gold_batch_stock_v`
- `gold_batch_lineage`
- `gold_batch_delivery_v`
- `gold_batch_mass_balance_v`
- `gold_material`
- customer/delivery evidence views
- supplier source, if verified
- production history source, if verified
- QM usage-decision source, if verified

For each source, classify:

- verified
- partially verified
- planned
- blocked
- prohibited / do not expose to Genie yet
- unknown

Define Genie-safe traceability concepts:

- batch identity
- material identity
- plant identity
- upstream lineage
- downstream lineage
- vendor receipt
- consumption
- production output
- delivery exposure
- customer exposure
- supplier exposure
- mass balance
- stock bucket
- quality inspection stock
- blocked stock
- restricted stock
- unknown exposure
- no records returned
- query time vs source freshness

Create safe answer rules:

- Unknown exposure is not zero exposure.
- No delivery rows is not proof of no customer exposure.
- No lineage rows is not proof of no batch history.
- No mass-balance rows is not proof of balance.
- Missing quality decision is not accepted/rejected.
- Query time is not source freshness.
- Genie must not recommend recall closure, release, shipment, or regulatory action.
- Genie should cite source views and state evidence gaps.

Create sample Traceability Genie questions:

- For material X, batch Y, plant Z, what downstream lineage is visible?
- Which customers appear in delivery evidence for this batch?
- Which LINK_TYPE values occur in this batch lineage?
- Show stock bucket quantities for this batch by plant.
- What evidence is missing for this investigation?
- Is customer exposure known, unknown, or partially available?

Create unsafe questions and required guarded response approach:

- Is this recall contained?
- Can we release this batch?
- Are all customers identified?
- Is exposure zero?
- Can I close the incident?

Acceptance:

- Traceability Genie readiness pack is detailed and conservative.
- It is aligned to current V2 Traceability docs and readiness gates.
- It does not expose unverified sources as safe.

---

## Scope E — POH Genie parity assessment

V1 POH appears to have explicit Genie assets. Deep dive and document parity.

Assess V1 POH artefacts such as:

- `apps/processorderhistory/genie/instructions/03_table_rules.md`
- `apps/processorderhistory/genie/joins/joins.yaml`
- any related queries/sample questions/instructions/expressions

Map V1 POH Genie support to V2 POH state:

- order header
- process order list/search
- operations/phases
- confirmations
- goods movements
- component consumption
- produced output
- material documents
- timeline
- downtime/issues
- equipment history
- quality inspection/usage decision
- staging/warehouse links

For each capability, classify:

- covered in V2 app
- covered by V1 Genie only
- V2 source exists but no Genie pack
- V2 app missing but Genie could help
- not safe for Genie yet
- unknown

Create a POH Genie parity matrix:

| POH Question / Capability | V1 Genie Support | V2 App Support | V2 Genie Gap | Recommended V2 Genie Treatment |
|---|---|---|---|---|

Acceptance:

- POH Genie parity is documented.
- Existing V1 instructions/joins are not blindly copied; they are evaluated against V2 source truthfulness.
- No-record semantics are preserved.

---

## Scope F — SPC Genie readiness assessment

Use recent SPC V1 source discovery as context.

Known SPC context:

- V1 SPC data exists.
- V2 SPC remains mock/sandbox unless V1 source mapping/proxy/native routes are implemented.
- V1 rule signals may be client-calculated.
- Control-limit provenance is critical.
- `spc_quality_metrics` may be an AI/BI Metric View rather than an app-serving signal table.
- `spc_locked_limits` key includes material, MIC, plant, operation, chart type.

Genie assessment must answer:

- Should Genie expose SPC questions now?
- Which SPC sources are safe?
- Should Genie use metric views directly?
- How should Genie explain control limits?
- How should Genie handle “no signals”?
- Can Genie answer capability questions safely?
- How should Genie distinguish specification limits and control limits?
- Should Genie answer “is this process in control?” before rule/limit provenance is validated?

Required safety rules:

- No signals returned is not “in control.”
- Missing control limits means control status is unavailable.
- Capability metrics require sample size/window context.
- Rule violations must identify whether they are stored, SQL-derived, backend-derived, frontend-derived, or unknown.
- Genie must not make regulatory/process-control decisions.

Acceptance:

- SPC Genie readiness is conservative.
- It references V1 source discovery docs where available.
- It recommends whether SPC Genie should be enabled now, deferred, or limited to documentation/exploration questions.

---

## Scope G — Warehouse and Quality Genie readiness assessment

Assess whether V1 has Genie or Genie-adjacent assets for Warehouse or Quality.

### Warehouse questions Genie might support

- stock overview
- staging status
- inbound receipts
- outbound deliveries
- transfer requirements
- exceptions
- production supply readiness

### Warehouse safety rules

- No exceptions returned is not “warehouse clean.”
- No stock issue returned is not proof of availability.
- No staging row returned is not proof staging is complete.
- Genie must not recommend SAP postings or stock movements.

### Quality questions Genie might support

- batch release status
- inspection lots
- MIC results
- deviations
- CoA evidence
- usage decisions
- quality holds

### Quality safety rules

- Missing usage decision is not accepted.
- Simulated release is not SAP release.
- No deviation rows is not proof of no deviations.
- Genie must not approve/release/reject a batch.
- Genie must not replace QA decision-making.

Acceptance:

- Warehouse and Quality Genie readiness are assessed.
- If no V1 Genie artefacts exist, propose V2-only readiness packs.
- Safety guardrails are explicit.

---

## Scope H — Cross-domain Genie architecture

Assess how V2 Genie should align to workspace-first architecture.

Questions:

- Should there be one Genie space per domain or one cross-domain workspace Genie?
- Should there be separate “safe” Genie spaces for UAT vs production?
- Should Genie consume only app-serving views?
- Should Genie use the same data-contract language as V2 panels?
- How should Genie receive context from V2 active investigation context?
- How should Genie handle a context such as:
  - materialId
  - batchId
  - plantId
  - processOrderId
  - micId
  - date range
- Should Genie answers include UAT evidence payload references?
- Should Genie be available in the UI or only configured in Databricks?
- Which domains should be enabled first?

Recommended position unless evidence says otherwise:

- Start with documentation/config readiness only.
- Prioritise POH because V1 has known Genie artefacts.
- Add Traceability only with strict guardrails.
- Defer SPC live Genie until V2 SPC mapping is complete.
- Defer Quality decision/release Genie until live QM usage-decision evidence and governance exist.
- Keep Warehouse Genie advisory only.

Acceptance:

- Cross-domain Genie plan aligns with workspace runtime and source-truthfulness architecture.
- It does not create a route around evidence panels that produces less safe answers.

---

## Scope I — Create V2 Genie documentation

Create a new folder:

```text
docs/genie/
```

Create these required files:

### 1. `docs/genie/v1-genie-comprehensive-inventory.md`

This must include:

- repo-wide search method
- search terms used
- folders inspected
- explicit Genie assets found
- Genie-adjacent assets found
- domains with no evidence found
- artefact classification
- business-question coverage by domain
- source/view coverage by domain
- join/expression/metric coverage by domain
- risk assessment

### 2. `docs/genie/v1-genie-to-v2-parity-matrix.md`

This must map every V1 Genie or Genie-adjacent artefact to:

- V2 domain
- V2 architecture equivalent
- whether parity exists
- whether V2 needs a Genie readiness pack
- whether the artefact should be reused, adapted, deprecated, or blocked
- safety guardrails required

### 3. `docs/genie/v2-genie-implementation-roadmap.md`

This must define the phased path from V1 Genie coverage to V2 workspace-first Genie coverage.

The roadmap must cover:

- POH
- Traceability
- SPC
- Warehouse
- Quality
- cross-domain workspace context
- source truthfulness
- UAT evidence capture
- Databricks/Unity Catalog security assumptions

### 4. `docs/genie/genie-truthfulness-guardrails.md`

This must include:

- universal safety rules
- domain-specific safe/unsafe answer patterns
- prohibited claims
- source/freshness requirements
- UAT evidence requirements
- examples of safe answer templates

Create these domain docs if the assessment supports them:

### 5. `domain-integrations/traceability/docs/traceability-genie-readiness-pack.md`

Include:

- approved views
- partially verified views
- blocked/prohibited views
- joins
- definitions
- expressions/calculations
- sample questions
- unsafe questions
- answer guardrails

### 6. `domain-integrations/operations/docs/poh-genie-parity.md`

Include:

- V1 POH Genie support
- V2 parity/gaps
- sample questions
- source-truthfulness rules
- joins/table rules that can be adapted safely

Optional if evidence supports:

### 7. `domain-integrations/spc/docs/spc-genie-readiness.md`

### 8. `domain-integrations/warehouse/docs/warehouse-genie-readiness.md`

### 9. `domain-integrations/quality/docs/quality-genie-readiness.md`

Update links from:

- `README.md`, if there is a docs index
- `docs/readiness/domain-readiness-index.md`
- relevant domain README files

Acceptance:

- Docs are discoverable.
- Docs distinguish V1 inventory from V2 target design.
- Docs do not claim Genie implementation exists if only readiness docs exist.

---

## Scope J — Define V2 Genie implementation phases

Create a phased plan.

### Phase 0 — Inventory and guardrails

- inventory V1 Genie artefacts
- define safety rules
- define prohibited questions/claims
- align to V2 truthfulness checklist

### Phase 1 — POH Genie parity

- start with POH because V1 has known Genie artefacts
- use existing V1 table rules/joins as reference
- align with V2 POH contracts and evidence states
- produce sample questions and expected answer shape

### Phase 2 — Traceability Genie readiness

- create strict Traceability Genie pack
- expose only verified/partially verified sources
- include unknown/partial-data language
- no recall/release decisions

### Phase 3 — SPC limited exploration

- defer full SPC Genie until V2 live mapping is implemented
- allow only source-discovery or sandbox questions if needed

### Phase 4 — Warehouse and Quality

- add domain packs after source validation
- keep action/release/posting questions prohibited

### Phase 5 — Cross-domain workspace context

- align Genie prompts with V2 active investigation context
- material/batch/plant/processOrder/MIC context
- evidence payload references
- source/freshness metadata

Acceptance:

- Phases are practical and ordered by risk.
- POH and Traceability are prioritised.
- SPC and Quality are conservative.

---

## Scope K — Define safe answer templates

For each major domain, create answer templates.

Each template should include:

- answer summary
- source views used
- filters/context used
- evidence completeness
- missing/unavailable evidence
- freshness caveat
- confidence / limitation note
- recommended next validation step

Example Traceability template:

> Based on `gold_batch_lineage` and `gold_batch_delivery_v` for material X, batch Y, plant Z, the visible downstream evidence includes … However, customer exposure is [known/unknown/partial]. No rows returned from a source must not be interpreted as zero exposure. Query ran at [time]; source freshness is [available/unavailable].

Example POH template:

> Based on process order sources for order X and plant Y, the loaded sections are header, operations, confirmations, and goods movements. Empty sections mean no records returned from the current source, not proof of no events.

Example SPC template:

> Based on the available SPC dataset for material X, MIC Y, plant Z, the returned chart points show … Control status is unavailable unless approved control limits and rule provenance are present. No signals returned is not proof that the process is in control.

Example Warehouse template:

> Based on the current warehouse evidence source, the returned exception rows are … No exception rows returned is not proof that the warehouse has no issues.

Example Quality template:

> Based on the current quality evidence source, the returned inspection/release records show … Missing usage decision evidence must not be interpreted as accepted or released.

Acceptance:

- Templates are concise.
- Templates are domain-safe.
- Templates do not make decisions for users.

---

## Scope L — Testing / validation

This is a documentation assessment tranche.

If only docs are changed:

- no code tests required
- state that no runtime code was changed

If any code or config references are changed:

Run relevant commands:

```bash
npm exec nx test data-contracts
npm exec nx typecheck data-contracts
```

and any affected domain tests.

Do not claim tests passed unless actually run.

---

## Expected initial response before editing

Before making changes, respond with:

1. Branch name.
2. V1 repo-wide search plan.
3. V2 files/directories to inspect.
4. Search terms and folders to check.
5. Initial hypothesis:
   “V1 Genie support appears partially present, especially in POH, but V2 does not yet have a first-class Genie parity/readiness layer.”
6. Planned docs to create/update.
7. Boundaries and deferred items.

Then perform the assessment and documentation work.

---

## Expected final response

Include:

- branch name
- V1 search method
- V1 files/directories inspected
- V2 files/directories inspected
- explicit V1 Genie artefacts found
- Genie-adjacent V1 artefacts found
- domains with Genie coverage
- domains with no Genie coverage
- V1 to V2 Genie parity summary
- Traceability Genie readiness summary
- POH Genie parity summary
- SPC Genie readiness summary
- Warehouse Genie readiness summary
- Quality Genie readiness summary
- cross-domain Genie architecture recommendation
- docs created/updated
- links added
- tests run, if any
- recommended next implementation phase
- confirmation that:
  - no live Genie integration was created
  - no Databricks columns were invented
  - no production readiness was claimed
  - no recall/release/QA/posting decisions were enabled
  - unknown/no-record/unavailable semantics were preserved

---

## Success criteria

After this tranche:

- V1 Genie usage is comprehensively inventoried across the repo.
- V1 Genie-adjacent semantic/question/query assets are captured.
- V2 has a clear Genie parity roadmap.
- Traceability has a governed Genie readiness pack.
- POH has a V1-to-V2 Genie parity assessment.
- SPC, Warehouse, and Quality have conservative Genie readiness assessments.
- Future agents know how to configure Genie spaces without bypassing V2 source-truthfulness.
- Genie is positioned as an evidence assistant, not a decision authority.
- The assessment can clearly say what is safe to reuse, what must be adapted, what should be blocked, and what remains unknown.
