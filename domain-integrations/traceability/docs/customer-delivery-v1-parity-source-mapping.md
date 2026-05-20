# Customer Delivery V1 Parity Source Mapping

**Domain:** `domain-integrations/traceability`
**Created:** 2026-05-20
**Status:** V1 source identified; gold_batch_delivery_v implementation in progress

---

## Purpose

This document answers the 12 V1 parity questions from the customer delivery work package and
records the definitive source decision for the V2 `POST /api/trace2/customer-deliveries` endpoint.

---

## Q1: Which V1 files implement customer delivery / customer exposure logic?

V1's application code queries `gold_batch_delivery_v` — a Databricks Unity Catalog view over
`gold_inventory_movement`. Evidence sources:

- `docs/migration/trace2-functional-parity-audit.md` §3 (column mapping table for
  `gold_batch_delivery_v`): DELIVERY, CUSTOMER_ID, CUSTOMER_NAME, COUNTRY_ID, CITY, ABS_QUANTITY
- `docs/migration/trace2-functional-parity-audit.md` §8 (V1 customer exposure behaviour):
  query keyed on material_id + batch_id against `gold_batch_delivery_v`
- `docs/migration/databricks-vertical-slices-trace-plan.md` Slice 4: proposes `gold_batch_delivery_v`
  with the same 6-column set as the V2 target

No V1 application file queries `gold_inventory_movement` directly. The movement-type filtering
(601/602/641) is encapsulated inside the Databricks view definition.

---

## Q2: Which Databricks view is the primary source?

**`gold_batch_delivery_v`** — a view over `gold_inventory_movement` that pre-filters to
goods-issue delivery movement types and exposes customer delivery metadata columns.

The relationship:

```
gold_inventory_movement  (fact table — all movement types)
        ↓ view definition filters to delivery movement types
gold_batch_delivery_v    (delivery records only — V1 app queries this)
        ↓ V2 app queries this view
POST /api/trace2/customer-deliveries
```

V2 must query `gold_batch_delivery_v` rather than `gold_inventory_movement` directly because:
- Querying `gold_inventory_movement` directly would require V2 to invent movement-type filter
  values (601, 602, 641) that are not confirmed in V2 app context — violates CLAUDE.md
  "No hardcoded mature-domain behaviour" constraint.
- `gold_batch_delivery_v` encapsulates the movement-type filter semantics inside the Databricks
  layer, which is the correct separation of concerns.

---

## Q3: Confirmed column set

| Column | Alias in SQL | Confidence | Source |
|---|---|---|---|
| `DELIVERY` | `delivery` | High | trace2-functional-parity-audit.md §3; Slice 4 plan |
| `CUSTOMER_ID` | `customer_id` | High | As above |
| `CUSTOMER_NAME` | `customer_name` | High | As above |
| `COUNTRY_ID` | `country_id` | High | As above |
| `CITY` | `city` | High | As above |
| `ABS_QUANTITY` | `abs_quantity` | High | As above |
| `POSTING_DATE` | `posting_date` | High | User confirmed 2026-05-20 |
| `MATERIAL_ID` | WHERE key | Pending DESCRIBE | Required for query; unverified column name |
| `BATCH_ID` | WHERE key | Pending DESCRIBE | Required for query; unverified column name |

**Action required before Scope E SQL:** Run `DESCRIBE TABLE connected_plant_uat.gold.gold_batch_delivery_v`
to confirm `MATERIAL_ID` and `BATCH_ID` as the WHERE-clause keys. The view is over
`gold_inventory_movement` which uses `MATERIAL_ID`/`BATCH_ID` naming (consistent with all other
gold views), but this must be confirmed live before writing production SQL.

---

## Q4: How does `gold_inventory_movement` relate to `gold_batch_delivery_v`?

`gold_inventory_movement` is the Databricks fact table storing all SAP MM/WM movement postings.
Key movement types relevant to customer delivery:

| Movement Type | Description | Included in `gold_batch_delivery_v` |
|---|---|---|
| 601 | Goods issue for delivery | Yes |
| 602 | Reversal of 601 | Yes (reversal records) |
| 641 | Goods issue for STO (stock transfer order) delivery | Yes |

`gold_batch_delivery_v` is a derived view that filters `gold_inventory_movement` to these
delivery-relevant movement types and surfaces delivery metadata columns. V2 queries the view,
not the fact table.

---

## Q5: Why no plant filter on customer delivery queries?

User confirmed 2026-05-20: "plant filtering is not relevant, a user needs to know wherever
a material went to a customer regardless for the recall/trace to be effective."

A batch may have been shipped from multiple plants. Filtering by plant would hide downstream
customer shipments made from other plants, creating false containment signals. The customer
delivery query must return all shipments regardless of originating plant.

This differs from the batch header query (which accepts plant_id for disambiguation) and the
lineage-only customer exposure query (which accepted plant_id for the anchor row filter).
The customer delivery endpoint does not accept or use plant_id.

---

## Q6: Was V1 exposure limited to direct shipments or multi-hop?

V1 showed customer deliveries from the delivery view. These are direct delivery records —
the view surfaces rows where the specified batch_id was shipped to a customer. It does not
traverse lineage hops.

For multi-hop traceability (i.e., "a sub-component of this batch ended up in a product
shipped to customers"), the lineage graph is needed. The `gold_batch_delivery_v` query
gives direct delivery evidence for the exact batch; the lineage recursive CTE gives
exposure depth for intermediate batches.

In this implementation, `gold_batch_delivery_v` provides the V1-parity direct delivery slice.
Multi-hop indirect exposure via lineage remains a separate concern.

---

## Q7: Were countries shown in V1?

Yes — V1 populated country from `COUNTRY_ID` on the delivery view. `gold_batch_delivery_v`
has a `COUNTRY_ID` column (High confidence). The V2 `countries` array in
`CustomerExposureSummarySchema` will be populated from distinct `COUNTRY_ID` values.

The lineage-only slice could not populate `countries` because `gold_batch_lineage` has no
country column. The delivery view resolves this gap.

---

## Q8: Were customer names shown in V1?

Yes — `CUSTOMER_NAME` is in the confirmed column set for `gold_batch_delivery_v`. V1 populated
customer names from the delivery view directly (no separate customer master join required for
the summary count, though names could appear in a detail list).

---

## Q9: Was shipped quantity calculated?

Yes — from `ABS_QUANTITY` (absolute quantity, confirmed column). The mapper sums `ABS_QUANTITY`
across all delivery rows to produce `shippedQuantity`. No UoM column has been confirmed in the
6+1 column set; the panel continues to show "source units" as the unit label until a UoM column
is confirmed in UAT.

---

## Q10: Were blocked deliveries shown?

V1 exposed a blocked delivery count. No blocked-status column has been confirmed in the
`gold_batch_delivery_v` column set at this time. The `blockedDeliveries` field will remain 0
in this slice until a blocked-status column is verified in UAT.

---

## Q11: Were sales orders shown?

V1 had sales order linkage. `gold_batch_delivery_v` may have a `SALES_ORDER_ID` column but
this was not in the confirmed 6-column set from §3. Deferred — not included in V2 first slice.

---

## Q12: How does this differ from the lineage-only slice?

| Attribute | Lineage-only slice | gold_batch_delivery_v slice |
|---|---|---|
| Source | `gold_batch_lineage` (LINK_TYPE='DELIVERY' edges) | `gold_batch_delivery_v` |
| Data confidence | Medium — LINK_TYPE population unvalidated | High — direct delivery records |
| Countries | Not available (no country column in lineage) | Available (`COUNTRY_ID`) |
| Customer names | Not available | Available (`CUSTOMER_NAME`) |
| Depth indicator | Yes (`maxExposureDepth` from hop_depth) | No — direct delivery records only |
| plant filter | Was accepted (anchor filter) | Not used (user confirmed) |
| V1 parity | Preliminary indicator only | V1-parity source |

The lineage-only slice (implemented 2026-05-20 on `POST /api/trace2/customer-exposure`) remains
in place as a preliminary exposure-depth indicator. It is not V1-parity evidence of customer
delivery. The `gold_batch_delivery_v` slice on `POST /api/trace2/customer-deliveries` is the
V1-parity implementation.

---

## Source Decision Summary

> **V2 `POST /api/trace2/customer-deliveries` queries `gold_batch_delivery_v` keyed on
> MATERIAL_ID + BATCH_ID with no plant filter.**
>
> The existing `POST /api/trace2/customer-exposure` (lineage-only) remains as a preliminary
> exposure-depth indicator and is **not** V1-parity customer delivery evidence.

---

## Pending Verifications

| Item | Status | Action |
|---|---|---|
| `MATERIAL_ID` column name in `gold_batch_delivery_v` | Pending DESCRIBE | Run `DESCRIBE TABLE connected_plant_uat.gold.gold_batch_delivery_v` |
| `BATCH_ID` column name in `gold_batch_delivery_v` | Pending DESCRIBE | As above |
| Any additional columns (UoM, SALES_ORDER_ID, blocked flag) | Pending DESCRIBE | As above |
| Null sparsity of `COUNTRY_ID` in delivery records | Pending UAT | Run validation query after DESCRIBE confirmed |
