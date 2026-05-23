"""Direct mapper-level tests for spc_databricks_chart_adapter.

These tests target map_spc_chart_response without going through the FastAPI
route. They cover the governance-safe semantics required when rows are found
in spc_locked_limits:

- numeric control-limit fields are populated only when the source row has them
- locked_by is exposed but does NOT imply governed approval
- approvalState stays in a governance-safe enum value
- limitProvenance is never "calculated-from-sample" when values come from
  spc_locked_limits (nothing was calculated from a sample)
- a caveat warning is emitted whenever a locked-limit row exists
- no capability fields (cp/cpk/pp/ppk) are emitted regardless of input
- no backend in-control / out-of-control decisions are emitted on points
"""
from __future__ import annotations

from adapters.spc.spc_databricks_chart_adapter import (
    map_spc_chart_response,
    get_spc_locked_limits_spec,
)
from contracts.spc import SpcChartDataRequest


def _request(**overrides) -> SpcChartDataRequest:
    base = {
        "materialId": "20642328",
        "plantId": "P523",
        "micId": "0010",
        "operationId": "00000004",
        "chartType": "xbar-r",
        "dateFrom": "2025-01-01",
        "dateTo": "2025-12-31",
    }
    base.update(overrides)
    return SpcChartDataRequest.model_validate(base)


def _subgroup_row(**overrides) -> dict:
    base = {
        "material_id": "20642328",
        "plant_id": "P523",
        "mic_id": "0010",
        "operation_id": "00000004",
        "batch_id": "B1",
        "batch_date": "2025-03-01",
        "first_posting_date": "2025-03-01",
        "last_posting_date": "2025-03-02",
        "batch_n": 5,
        "sum_value": 50.0,
        "sum_squares": 510.0,
        "min_value": 9.0,
        "max_value": 11.0,
        "batch_range": 2.0,
        "any_rejection": False,
        "any_acceptance": True,
        "usl_spec": 11.0,
        "lsl_spec": 9.0,
        "nominal_target": 10.0,
        "tolerance_half_width": 1.0,
        "raw_tolerance": 2.0,
        "spec_signature": "sig-1",
        "spec_type": "two-sided",
        "individual_values": [9.5, 9.8, 10.0, 10.2, 10.5],
        "source_row_count": 5,
    }
    base.update(overrides)
    return base


def _locked_limit_row(**overrides) -> dict:
    base = {
        "cl": 10.0,
        "ucl": 12.0,
        "lcl": 8.0,
        "ucl_r": None,
        "lcl_r": None,
        "sigma_within": None,
        "locked_by": "user1",
        "locked_at": "2025-01-01T00:00:00Z",
        "baseline_from": "2024-01-01",
        "baseline_to": "2024-12-31",
        "locking_note": "governance approval pending",
    }
    base.update(overrides)
    return base


class TestLockedLimitsBranch:
    def test_locked_limit_row_populates_numeric_fields(self) -> None:
        result = map_spc_chart_response(
            subgroup_rows=[_subgroup_row()],
            limit_rows=[_locked_limit_row()],
            request=_request(),
            queried_at="2026-05-23T00:00:00Z",
        )
        cl = result["controlLimits"]
        assert cl["centerLine"] == 10.0
        assert cl["upperControlLimit"] == 12.0
        assert cl["lowerControlLimit"] == 8.0
        assert cl["lockedLimits"] is True

    def test_locked_limit_row_with_null_numerics_keeps_none(self) -> None:
        result = map_spc_chart_response(
            subgroup_rows=[_subgroup_row()],
            limit_rows=[_locked_limit_row(cl=None, ucl=None, lcl=None)],
            request=_request(),
            queried_at="2026-05-23T00:00:00Z",
        )
        cl = result["controlLimits"]
        assert cl["centerLine"] is None
        assert cl["upperControlLimit"] is None
        assert cl["lowerControlLimit"] is None
        # The row still exists, so we still flag it as locked + warn.
        assert cl["lockedLimits"] is True

    def test_locked_by_is_not_treated_as_approval(self) -> None:
        result = map_spc_chart_response(
            subgroup_rows=[_subgroup_row()],
            limit_rows=[_locked_limit_row(locked_by="someone-influential")],
            request=_request(),
            queried_at="2026-05-23T00:00:00Z",
        )
        cl = result["controlLimits"]
        assert cl["lockedBy"] == "someone-influential"
        # locked_by must NOT bump approval state to "approved".
        assert cl["approvalState"] != "approved"
        assert cl["approvalState"] == "pending-validation"

    def test_limit_provenance_is_not_calculated_from_sample(self) -> None:
        result = map_spc_chart_response(
            subgroup_rows=[_subgroup_row()],
            limit_rows=[_locked_limit_row()],
            request=_request(),
            queried_at="2026-05-23T00:00:00Z",
        )
        # When values come from spc_locked_limits, the response must NOT claim
        # they were calculated from the sample.
        assert result["controlLimits"]["limitProvenance"] != "calculated-from-sample"
        # And we don't claim they came from an approved governed source either.
        assert result["controlLimits"]["limitProvenance"] != "imported-from-approved-source"
        assert result["controlLimits"]["limitProvenance"] == "unknown"

    def test_caveat_warning_is_emitted_when_locked_rows_present(self) -> None:
        result = map_spc_chart_response(
            subgroup_rows=[_subgroup_row()],
            limit_rows=[_locked_limit_row()],
            request=_request(),
            queried_at="2026-05-23T00:00:00Z",
        )
        warnings = result["warnings"]
        assert len(warnings) == 1
        assert "governance-pending" in warnings[0]
        assert "locked_by is not treated as approval" in warnings[0]


class TestNoLockedLimitsBranch:
    def test_no_warning_emitted_when_no_locked_rows(self) -> None:
        result = map_spc_chart_response(
            subgroup_rows=[_subgroup_row()],
            limit_rows=[],
            request=_request(),
            queried_at="2026-05-23T00:00:00Z",
        )
        assert result["warnings"] == []
        assert result["controlLimits"]["lockedLimits"] is False

    def test_locked_metadata_absent_when_no_rows(self) -> None:
        result = map_spc_chart_response(
            subgroup_rows=[_subgroup_row()],
            limit_rows=[],
            request=_request(),
            queried_at="2026-05-23T00:00:00Z",
        )
        cl = result["controlLimits"]
        assert cl["lockedBy"] is None
        assert cl["lockedAt"] is None
        assert cl["lockedFrom"] is None
        assert cl["lockedTo"] is None
        assert cl["lockingNote"] is None


class TestGuardrailsRegardlessOfInput:
    def test_no_capability_fields_emitted(self) -> None:
        result = map_spc_chart_response(
            subgroup_rows=[_subgroup_row()],
            limit_rows=[_locked_limit_row()],
            request=_request(),
            queried_at="2026-05-23T00:00:00Z",
        )
        # Top-level keys
        for forbidden in ("cp", "cpk", "pp", "ppk"):
            assert forbidden not in result
        # Capability source enum stays unavailable.
        assert result["capabilitySource"] == "unavailable"

    def test_signals_source_remains_calculated_frontend(self) -> None:
        result = map_spc_chart_response(
            subgroup_rows=[_subgroup_row()],
            limit_rows=[_locked_limit_row()],
            request=_request(),
            queried_at="2026-05-23T00:00:00Z",
        )
        assert result["signalsSource"] == "calculated-frontend"

    def test_points_carry_no_in_control_or_status_decision(self) -> None:
        result = map_spc_chart_response(
            subgroup_rows=[_subgroup_row(), _subgroup_row(batch_id="B2")],
            limit_rows=[_locked_limit_row()],
            request=_request(),
            queried_at="2026-05-23T00:00:00Z",
        )
        for pt in result["chartSeries"]:
            # Backend must not pre-decide control state.
            assert "status" not in pt
            # And per-point warnings collection stays empty unless the mapper
            # was given a calculated/governed signal source — which it wasn't.
            assert pt["warnings"] == []


class TestLockedLimitsQuerySpec:
    def test_query_spec_name_contains_locked_limits(self, monkeypatch) -> None:
        # Test-side guard: keep the test mock's `if "locked_limits" in spec.name`
        # condition honest. If the QuerySpec name changes, this test breaks
        # before the route test silently stops exercising the branch.
        monkeypatch.setenv("SPC_CATALOG", "connected_plant_uat")
        monkeypatch.setenv("SPC_SCHEMA", "gold")
        spec = get_spc_locked_limits_spec(_request())
        assert "locked_limits" in spec.name

    def test_query_spec_binds_required_filters(self, monkeypatch) -> None:
        monkeypatch.setenv("SPC_CATALOG", "connected_plant_uat")
        monkeypatch.setenv("SPC_SCHEMA", "gold")
        spec = get_spc_locked_limits_spec(_request())
        for param in ("material_id", "plant_id", "mic_id", "operation_id", "resolved_chart_type"):
            assert param in spec.params
