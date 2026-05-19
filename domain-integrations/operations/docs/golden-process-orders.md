# Golden Process Orders (UAT Candidate Ledger)

This document catalogs known manufacturing process orders in the Databricks Unity Catalog UAT environment (`connected_plant_uat.csm_process_order_history`). Use these candidate orders during E2E browser and API testing.

---

## Candidate Orders

### 1. Process Order `7006965038`
- **Plant ID**: `C113`
- **Material ID**: `70373871`
- **Material Description**: `MIXED BERRY FLV LQD`
- **Order Status**: `CLOSED`
- **Evidence Description**:
  - **Operations**: Returns exactly 11 operations (phases OP-010 to OP-110) from `vw_gold_process_order_phase`.
  - **Goods Movements**: Includes Goods Issues (261) and Goods Receipts (101) from `vw_gold_adp_movement`.
- **Validation Status**: **SQL OK**. E2E Browser verification pending.

---

### 2. Process Order `7006965039`
- **Plant ID**: `C113`
- **Material ID**: `70373871`
- **Material Description**: `MIXED BERRY FLV LQD`
- **Order Status**: `CLOSED`
- **Evidence Description**:
  - **Operations**: Returns exactly 13 operations (phases OP-010 to OP-130) from `vw_gold_process_order_phase`.
  - **Confirmations**: Contains 15 posted yield confirmations from `vw_gold_confirmation` totaling `375 KG` with actual operator postings from October/November 2025.
- **Validation Status**: **SQL OK**. E2E Browser verification pending.
