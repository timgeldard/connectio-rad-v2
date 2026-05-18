# Process Order History - Native Browser E2E UAT Smoke Test Guide

This guide is designed for the model/engineer with active UAT/Databricks database permissions (Claude) to verify the E2E integrity of the newly implemented Process Order History review screen.

## 1. Setup & Environment Verification
Before starting browser testing:
1. Ensure your local environment is configured with `VITE_ADAPTER_MODE=legacy-api` (this directs the frontend to query the FastAPI proxy, where the backend `BACKEND_ADAPTER_MODE` environment variable decides if it queries live Databricks or V1 proxy APIs).
2. Confirm the Fast API proxy server is running on port 8000:
   ```bash
   python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload --app-dir apps/api
   ```
3. Run the React development server:
   ```bash
   npm exec nx -- run web:dev
   ```

## 2. Navigating to the Order History View
1. Open the browser and visit: `http://localhost:4200/?workspace=process-order-review`
2. You will be greeted by the new default **Order History** cockpit.
3. Verify that the **VerificationStatusBanner** renders correctly:
   - Title: `Process Order History Integration Specifications`
   - Status: `EXECUTABLE PENDING BV` (rendered in amber/orange)
   - Click to expand: Verify the Specifications Drawer lists the 4 active FastAPI endpoints, the 4 `process_order_` source views, active limitations, and UAT audit metadata.

## 3. Running an Offline/Mock Baseline Verification
1. On the search panel, click **Load Demo-Only Fixture**.
2. Confirm fields are populated and grouped:
   - Order ID: `PO-240308-3847`
   - Plant ID: `IE10`
   - **Diagnostic Wording Fieldset:** Confirm that Posting Date From, Posting Date To, and Max Rows Limit are grouped inside a dashed amber-tinted box titled `⚠️ Diagnostic / planned filters — not applied by current native routes`.
3. Confirm that the **Mock warning banner** is active below the form:
   - states: `Mock fixture selected — values are demo-only and are not known UAT data. Run against a real UAT process order before claiming browser verification.`
4. Click **Run / Refresh**.
5. Confirm all data tables load immediately with mock data:
   - Operations (OP-010 to OP-080)
   - Confirmations (CONF-001 to CONF-007)
   - Goods Movements (GM-001 to GM-004)
   - Operational Workload Summary
   - Chronological Event Timeline
   - Data Quality Exception panel (noting Mixed UOMs)
6. Check that each card displays its dynamic source status badge at the top right as `MOCK FIXTURE - NOT LIVE` (gray).

## 4. Running E2E UAT Verification Sweep (Real Databricks)
Now, change adapter mode to target the live database:
1. Stop the Vite server, set `VITE_ADAPTER_MODE=legacy-api` to query the FastAPI backend proxy, and ensure the backend is configured with `BACKEND_ADAPTER_MODE=databricks-api` for real Databricks data. Restart the Vite server.
2. In the query form, enter a known, verified UAT process order ID. Example:
   - **Process Order ID:** `7006965038`
   - **Plant ID:** `IE10`
3. Click **Run / Refresh**.
4. Check each card's dynamic source status badge:
   - Confirm they display `DATABRICKS-API` (green) instead of `MOCK`.
5. Verify each section:
   - **Operations:** Ensure it renders 11 operations matching the Unity Catalog query rows.
   - **Confirmations:** Check if confirmations display correctly from `vw_gold_confirmation`. If the endpoint returns empty due to missing DDL columns, check the collapsible Technical drawer to see the exact URL called and response logs.
   - **Goods Movements:** Ensure issues/receipts render and their directions (`input` / `output`) are correctly classified based on movement type (e.g., 101/261).
   - **Timeline:** Confirm that actual start/finish dates are sorted in perfect chronological ascending order.
   - **Technical Details:** Click "Show Technical Query Diagnostics" to verify all 4 API URLs are logged with successful HTTP statuses and query payload strings, and that a clear note explains date/limit parameter behavior.

## 5. Stop Conditions / Diagnostic Checklist
If queries fail, check:
- Is FastAPI proxy forwarding successfully? View FastAPI terminal logs.
- If `/api/por/order-confirmations` throws a 500/502, check if the Unity Catalog view `connected_plant_uat.csm_process_order_history.vw_gold_confirmation` columns matches `ProcessOrderConfirmationSchema`. If it fails, document the mismatch in the Technical Diagnostics section and notify the team.
