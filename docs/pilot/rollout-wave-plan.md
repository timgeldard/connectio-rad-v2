# Rollout Wave Plan

**Route:** `?workspace=admin-pilot-rollout-plan`
**Phase:** 8

## Purpose

4-wave production rollout plan for ConnectIO-RAD V2. Wave 0 is the controlled pilot. Waves 1–3 are planned production rollout waves, each gated on the previous wave's exit criteria.

## Wave Overview

### Wave 0 — Controlled Pilot (IE10)

- **Status:** Active
- **Plants:** IE10 Kerry Listowel
- **Roles:** quality-lead, food-safety-lead, operations-supervisor, warehouse-manager
- **Workspaces:** quality-batch-release, trace-investigation, operations-plan-risk, warehouse-360-overview, production-staging
- **Start:** 2026-05-15 | **End:** 2026-08-31
- **Exit Criteria:** All 6 scenarios passed (≥80% pass rate), 8 sign-offs, 0 prod blockers, ≥9/10 gates, all 12 PEC met

### Wave 1 — Production Go-Live (IE10)

- **Status:** Planned
- **Conditions:** All Wave 0 exit criteria met, production connectors deployed
- **Start:** 2026-09-01 | **End:** 2026-10-31
- **Legacy status:** Read-only fallback mode

### Wave 2 — Expansion (IE10 + 2 Plants)

- **Status:** Not Started
- **Plants:** IE10, IE20 (Kerry Charleville), NL05 (Kerry Almere)
- **Conditions:** Wave 1 exit criteria met, SAP PM contract signed
- **Start:** 2026-11-01 | **End:** 2027-01-31

### Wave 3 — Full Rollout

- **Status:** Not Started
- **Plants:** All Kerry plants globally
- **Conditions:** Wave 2 exit criteria met, global support model in place
- **Start:** 2027-02-01 | **End:** 2027-12-31

## Rollback Policy

Each wave has a documented rollback plan. Legacy apps remain accessible through at least Wave 1. Do not decommission legacy apps until a plant has completed at least 30 days of stable production use of V2.
