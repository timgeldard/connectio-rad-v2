# ADR-023: Rollout Wave Model and Legacy Retirement Approach

**Status:** Accepted  
**Date:** 2026-05-15  
**Deciders:** pilot-lead, programme-manager, CTO office  
**Phase:** 8

## Context

Phase 8 introduces the production rollout plan. We needed to decide the wave structure, the relationship to legacy app retirement, and the rollback policy.

## Decision

The rollout follows 4 waves:
- **Wave 0:** Controlled pilot (IE10 only, no production writes from V2, legacy apps primary)
- **Wave 1:** Production go-live at IE10 (V2 primary, legacy apps in read-only fallback)
- **Wave 2:** Expansion to IE10 + 2 additional plants
- **Wave 3:** Full corporate rollout, legacy app retirement on a plant-by-plant schedule

Legacy apps are **not retired** during Wave 0 or Wave 1. Retirement is deferred to Wave 3, plant-by-plant, following ≥30 days of stable production use of V2.

## Rationale

- Not retiring legacy apps prematurely is a non-negotiable project constraint.
- Maintaining legacy apps as read-only fallback in Wave 1 provides a safety net during the first live production period.
- Per-plant retirement (not global) aligns with the plant-by-plant rollout cadence and minimises blast radius.

## Consequences

- Legacy apps must remain maintained and accessible through at least Wave 2.
- The Cutover Simulation and Legacy Retirement Readiness admin pages remain relevant through Wave 2.
- Wave 3 retirement schedule must include per-plant formal approval from plant operations leads.
