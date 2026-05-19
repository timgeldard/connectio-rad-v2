# Golden Test Batches — Traceability Investigation Cockpit (V2)

**Status:** Pre-validation register  
**Date issued:** 2026-05-19  
**Audience:** QA, food safety, supply chain testers

> **Mock-only constraint — read before using this register.**
> As of 2026-05-19, the V2 traceability cockpit is backed by mock data only. No browser session against a live Databricks or legacy-api source has been performed. The "expected" values in this register for the mock development batch come from the mock fixture in `trace2-mock-data.ts` — they are not live-validated figures. The reference candidate entries and any future entries must be validated against live Databricks gold views before the "expected" columns can be completed.
>
> Do not treat values marked "(mock)" as expected production output.

---

## What "validated" means

A batch entry in this register is considered **validated** when:

1. A real user session against the V2 app has loaded the batch via the query form.
2. The data displayed in the cockpit has been confirmed correct by cross-referencing against the live Databricks gold views (`gold_batch_delivery_v`, `gold_batch_mass_balance_v`, `gold_batch_quality_*`) or against SAP source records.
3. The tester has signed off the run in `uat-validation-ledger.md` with a run ID, date, environment, and app version commit.

Passing a unit test or showing data in mock mode does not count as validation.

---

## Batch Register

---

### Entry 1 — Mock development batch

| Field | Value |
|---|---|
| **material_id** | `100023847` |
| **batch_id** | `CH-240308-0047` |
| **plant_id** | `IE10` |
| **why_useful** | Primary development and unit-test fixture. All Phase 1 component and adapter tests use this batch. Exercises the main "active investigation with critical downstream exposure" scenario. |
| **expected_lineage_direction** | Both upstream and downstream (mock) |
| **expected_downstream_exposure** | Mock returns: 3 customers across IE, GB, DE; 1 400 KG shipped; 5 deliveries; 2 blocked deliveries; recall recommended. Values are from the mock fixture only — not live-validated. |
| **expected_customer_evidence** | Mock returns: `affectedCustomers: 3`, `affectedDeliveries: 5`, `shippedQuantity: 1400`, `countries: ['IE', 'GB', 'DE']`, `highestSeverity: 'critical'`. Values are from the mock fixture only. |
| **expected_stock_evidence** | Mock returns: quantity 2 400 KG, stockStatus `quality-inspection`, releaseStatus `blocked`, batchStatus `blocked`. Values are from the mock fixture only. |
| **expected_quality_evidence** | Mock returns: qualityStatus `pending`, releaseStatus `blocked`. Values are from the mock fixture only. |
| **expected_coa_evidence** | Mock returns: CoA available (`coaAvailable: true`), releaseStatus `blocked`, usageDecision `reject`, 0 failed characteristics, 2 pending results. Values are from the mock fixture only. |
| **expected_mass_balance_evidence** | Mock returns: input 24 002.4 KG-equivalent, output 2 400.0 KG, variance 21 602.4 KG-equivalent (10%), confidence 0.94, 1 unresolved movement. The large variance reflects the raw milk input expressed in litres vs. the cheese output in KG — it is a units artefact in the mock, not a real mass balance signal. Values are from the mock fixture only. |
| **validation_date** | Not applicable |
| **validation_status** | Mock data — no UAT required. This batch does not exist in any live system. |
| **source_of_evidence** | `domain-integrations/traceability/src/adapters/trace2-mock-data.ts` |

**Additional notes for this batch:**
- The mock scenario represents a fictional Emmental cheese batch at Kerry Listowel plant (IE10), manufactured 2024-03-08, expiry 2024-09-08. (The `plantName` value in the mock fixture is `Kerry Listowel`.)
- The investigation context is: INV-2024-003847, severity `high`, status `in-progress`.
- The investigation trigger in the mock is an elevated Listeria monocytogenes environmental signal in the ripening zone.
- Upstream lineage in mock: 2 raw material nodes (Pasteurised Whole Milk — 24 000 L, Cheese Starter Culture DVS 3000 — 2.4 KG), 1 unresolved supplier lot (Golden Vale Dairy Co-op, SL-GOLDEN-240308-019).
- All of the above is fictional and intended only for component development and UI testing.

---

### Entry 2 — Reference candidate A

| Field | Value |
|---|---|
| **material_id** | `000000000020052009` |
| **batch_id** | `0008602411` |
| **plant_id** | `C061` |
| **why_useful** | Known reference candidate from prior traceability work. Intended as the first real-data validation batch once live Databricks access is available. |
| **expected_lineage_direction** | Unknown — requires UAT validation |
| **expected_downstream_exposure** | Unknown — requires UAT validation |
| **expected_customer_evidence** | Unknown — requires UAT validation |
| **expected_stock_evidence** | Unknown — requires UAT validation |
| **expected_quality_evidence** | Unknown — requires UAT validation |
| **expected_coa_evidence** | Unknown — requires UAT validation |
| **expected_mass_balance_evidence** | Unknown — requires UAT validation |
| **validation_date** | Not yet performed |
| **validation_status** | Requires UAT validation. No browser or Databricks session has been performed against this batch in V2. |
| **source_of_evidence** | Prior traceability project reference only. No data-contract or source validation performed. |

**Additional notes for this batch:**
- This batch was identified as a candidate reference from prior traceability work. The identifiers have been recorded here for use in first-run UAT.
- Before running UAT with this batch: confirm the batch still exists in the target Databricks environment, and that plant C061 is accessible to the test user's OAuth identity.
- All "expected" fields above must be completed by a tester after a successful live session. Do not fill in values based on inference or prior V1 behaviour — V1 parity has not been established for V2.

---

### Entry 3 — Next validated batch (template)

| Field | Value |
|---|---|
| **material_id** | _(to be completed by QA)_ |
| **batch_id** | _(to be completed by QA)_ |
| **plant_id** | _(to be completed by QA)_ |
| **why_useful** | _(describe why this batch was selected — e.g. known supplier issue, multi-plant lineage, zero-delivery containment, etc.)_ |
| **expected_lineage_direction** | _(upstream / downstream / both — confirm from live session)_ |
| **expected_downstream_exposure** | _(complete from live session output — do not infer from V1)_ |
| **expected_customer_evidence** | _(complete from live session output)_ |
| **expected_stock_evidence** | _(complete from live session output)_ |
| **expected_quality_evidence** | _(complete from live session output)_ |
| **expected_coa_evidence** | _(complete from live session output)_ |
| **expected_mass_balance_evidence** | _(complete from live session output)_ |
| **validation_date** | _(date of successful UAT session)_ |
| **validation_status** | _(pending / validated / blocked)_ |
| **source_of_evidence** | _(UAT run ID from `uat-validation-ledger.md`, plus Databricks gold view names queried)_ |

---

## How to add new batches

To register a new test batch:

1. Copy the template above (Entry 3) and append it to this file as a new numbered entry.
2. Fill in `material_id`, `batch_id`, and `plant_id` from the real SAP records.
3. Describe why this batch is useful in `why_useful` — the richer the reason, the more useful the register becomes over time.
4. Leave all "expected" fields as "Unknown — requires UAT validation" until a live session has been completed.
5. After the live session, update the expected fields with the values observed in the V2 cockpit, cross-referenced against Databricks gold views or SAP records.
6. Set `validation_status` to "validated" and record the `validation_date` and UAT run ID.
7. Never copy expected values from the mock fixture or from V1 output into the "expected" fields for a real batch. Each batch's expected behaviour must come from a V2 live session against the real data source.

A batch is only "validated" when a real tester, in a real environment, with a real OAuth session, has confirmed that the V2 cockpit output matches the underlying gold views. Mock output and unit test output do not qualify.
