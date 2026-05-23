"""Direct mapper unit tests for the Trace App data products.

The catalogue P0 follow-on (docs/app-data-layer/domain-data-product-catalog.md)
calls out two gaps in this layer: `build_batch_quality_passport` and
`map_investigation_timeline_rows` had no direct mapper unit tests.

These tests exercise the mappers ONLY — they intentionally do NOT import
`main` so they can run independently of the FastAPI app, and they don't
need any environment variables, databricks config, or HTTP mocking.

The route-level safety contract is exercised separately in
`tests/routes/test_trace_app_routes.py`.
"""
from __future__ import annotations

import pytest

from adapters.trace2.trace2_databricks_adapter import (
    build_batch_quality_passport,
    map_investigation_timeline_rows,
)


# ---------------------------------------------------------------------------
# Fixtures — minimal row shapes that match what the source queries return.
# ---------------------------------------------------------------------------

def _identity_row(**overrides) -> dict:
    """One row from gold_batch_stock_v + summary_v + material + plant + production_history JOIN."""
    base = {
        "material_id": "20582002",
        "batch_id": "0008898869",
        "plant_id": "C351",
        "material_name": "Emmental cheese block",
        "plant_name": "Charleville",
        "process_order_id": "PO-2024-03-0847",
        "manufacture_date": "2024-03-08",
        "expiry_date": "2024-09-08",
        "uom": "KG",
        "unrestricted": 12450,
        "blocked": 2100,
        "quality_inspection": 850,
        "restricted": 450,
        "transit": 1200,
        "production_line": "Cheese line 3",
        "production_operator": "J. Cremins",
        "production_started_at": "2024-03-08T06:00:00",
        "production_confirmed_at": "2024-03-08T16:30:00",
        "production_planned_qty": 17050,
        "production_actual_qty": 17050,
    }
    base.update(overrides)
    return base


def _coa_row(**overrides) -> dict:
    """One row from gold_batch_quality_result_v."""
    base = {
        "mic": "MIC-001",
        "param": "Moisture",
        "low": 38.0,
        "high": 42.0,
        "target": 40.0,
        "actual_qty": 40.2,
        "actual_qual": None,
        "uom": "%",
        "valuation": "A",
    }
    base.update(overrides)
    return base


def _lot_row(**overrides) -> dict:
    """One row from gold_batch_quality_lot_v."""
    base = {
        "id": "LOT-2024-3-08-A",
        "date": "2024-03-08T11:42:00",
        "inspection": "Lab MIC + retain",
        "usage_decision": "Accepted",
        "decision_by": "S. Murphy",
    }
    base.update(overrides)
    return base


def _summary_row(**overrides) -> dict:
    """One row from gold_batch_quality_summary_v."""
    base = {
        "lot_count": 4,
        "failed_mic_count": 0,
        "accepted_result_count": 24,
        "rejected_result_count": 0,
    }
    base.update(overrides)
    return base


def _balance_row(**overrides) -> dict:
    """One aggregated row from gold_batch_mass_balance_v."""
    base = {
        "produced": 17050.0,
        "consumed": -100.0,
        "shipped": -4280.0,
        "adjusted": 0.0,
        "latest_balance": 12670.0,
        "uom": "KG",
    }
    base.update(overrides)
    return base


# ===========================================================================
# build_batch_quality_passport
# ===========================================================================


class TestBuildBatchQualityPassport:
    """Composite passport mapper across 5 source queries."""

    def test_empty_identity_returns_none(self) -> None:
        """No batch in primary sources → 404, NEVER a synthesised passport."""
        assert build_batch_quality_passport([], [], [], [], []) is None

    def test_identity_only_emits_complete_passport(self) -> None:
        """Identity-only call still produces a valid passport with empty
        sections. The route must not 404 on missing CoA / lots / balance —
        the absence of evidence is itself evidence."""
        result = build_batch_quality_passport(
            identity_rows=[_identity_row()],
            coa_rows=[],
            lot_rows=[],
            summary_rows=[],
            balance_rows=[],
        )
        assert result is not None
        assert result["identity"]["materialId"] == "20582002"
        assert result["quality"]["coa"] == []
        assert result["lotHistory"] == []
        assert result["usageDecisionEvidence"] == []

    def test_confidence_source_is_application_heuristic(self) -> None:
        """The score is heuristic. The marker MUST always be set so the UI
        cannot misread it as a governed metric."""
        result = build_batch_quality_passport(
            [_identity_row()], [_coa_row()], [], [_summary_row()], []
        )
        assert result is not None
        assert result["quality"]["confidenceSource"] == "application-heuristic"

    def test_no_findings_yields_no_quality_flags_note(self) -> None:
        result = build_batch_quality_passport(
            [_identity_row()],
            [_coa_row(valuation="A", actual_qty=40.0)],
            [],
            [_summary_row(failed_mic_count=0, rejected_result_count=0)],
            [],
        )
        assert result is not None
        assert result["quality"]["notes"] == ["No quality flags"]
        assert result["quality"]["heuristicQualityConfidence"] == 100
        assert result["quality"]["heuristicQualityStatus"] == "accepted"

    def test_failed_mic_lowers_confidence_and_flags_rejected(self) -> None:
        result = build_batch_quality_passport(
            [_identity_row()],
            [_coa_row(valuation="R", actual_qty=50.0)],
            [],
            [_summary_row(failed_mic_count=1)],
            [],
        )
        assert result is not None
        assert result["quality"]["heuristicQualityStatus"] == "rejected"
        # 100 - 20 * 1 = 80
        assert result["quality"]["heuristicQualityConfidence"] == 80
        assert any("failed MIC" in n for n in result["quality"]["notes"])

    def test_warn_status_lowers_confidence_and_flags_conditional(self) -> None:
        # Build a CoA row that triggers warn status — actual right at upper edge.
        result = build_batch_quality_passport(
            [_identity_row()],
            [_coa_row(low=38.0, high=42.0, target=40.0, actual_qty=41.7, valuation="A")],
            [],
            [_summary_row(failed_mic_count=0)],
            [],
        )
        assert result is not None
        # The CoA classifier produces warn status near the upper tolerance.
        assert result["quality"]["coa"][0]["status"] == "warn"
        # heuristicQualityStatus flips to 'conditional' on any warn.
        assert result["quality"]["heuristicQualityStatus"] == "conditional"
        # 100 - 5 = 95
        assert result["quality"]["heuristicQualityConfidence"] == 95

    def test_binary_coa_value_preserved_when_low_equals_high(self) -> None:
        """Listeria-style binary characteristics carry a textual `binary`
        value (e.g. 'Absent'). The mapper must surface it when low == high == 0."""
        result = build_batch_quality_passport(
            [_identity_row()],
            [
                _coa_row(
                    mic="MIC-006",
                    param="Listeria",
                    low=0,
                    high=0,
                    target=0,
                    actual_qty=None,
                    actual_qual="Absent",
                    uom="/25g",
                    valuation="A",
                )
            ],
            [],
            [],
            [],
        )
        assert result is not None
        listeria = result["quality"]["coa"][0]
        assert listeria["binary"] == "Absent"

    def test_lot_history_classifies_usage_decision_keywords(self) -> None:
        """Mapping rule:
            - 'reject' in decision → result='reject'
            - 'accept' in decision → result='accept'
            - decision present but neither word → result='conditional'
            - decision missing → result='conditional' (no governed inference)
        """
        lots = [
            _lot_row(id="L1", usage_decision="Accepted with concession"),
            _lot_row(id="L2", usage_decision="Rejected — batch restricted"),
            _lot_row(id="L3", usage_decision="Pending review"),
            _lot_row(id="L4", usage_decision=None),
        ]
        result = build_batch_quality_passport(
            [_identity_row()], [], lots, [], []
        )
        assert result is not None
        history = result["lotHistory"]
        assert [h["id"] for h in history] == ["L1", "L2", "L3", "L4"]
        assert [h["result"] for h in history] == ["accept", "reject", "conditional", "conditional"]

    def test_usage_decision_evidence_picks_latest_accept_only(self) -> None:
        """The evidence list only includes the latest accepted lot. Rejected
        and pending lots MUST NOT be misrepresented as governed approval."""
        lots = [
            _lot_row(id="L1", usage_decision="Accepted", decision_by="S. Murphy", date="2024-03-08"),
            _lot_row(id="L2", usage_decision="Rejected", decision_by="D. Ferreira", date="2024-03-09"),
        ]
        result = build_batch_quality_passport([_identity_row()], [], lots, [], [])
        assert result is not None
        evidence = result["usageDecisionEvidence"]
        # Exactly one entry, role 'QA reviewer', decisionType 'usage-decision-recorded'.
        assert len(evidence) == 1
        assert evidence[0]["role"] == "QA reviewer"
        assert evidence[0]["decisionBy"] == "S. Murphy"
        assert evidence[0]["decisionType"] == "usage-decision-recorded"

    def test_usage_decision_evidence_is_empty_when_no_accept(self) -> None:
        """If no lot reaches accept, the evidence array is empty — the UI
        gets the source-truthful state (no QA evidence)."""
        lots = [
            _lot_row(usage_decision="Rejected"),
            _lot_row(usage_decision=None),
        ]
        result = build_batch_quality_passport([_identity_row()], [], lots, [], [])
        assert result is not None
        assert result["usageDecisionEvidence"] == []

    def test_mass_balance_reconciled_when_variance_under_threshold(self) -> None:
        """variance = produced + adjusted + consumed + shipped - current.
        With the default fixtures (17050 + 0 + (-100) + (-4280) - 12670 = 0.0)."""
        result = build_batch_quality_passport(
            [_identity_row()], [], [], [], [_balance_row()]
        )
        assert result is not None
        assert result["massBalance"]["variance"] == 0.0
        assert "Reconciled" in result["massBalance"]["note"]

    def test_mass_balance_unexplained_when_postings_dont_close(self) -> None:
        result = build_batch_quality_passport(
            [_identity_row()],
            [],
            [],
            [],
            [_balance_row(latest_balance=12000.0)],  # short by 670 KG
        )
        assert result is not None
        assert result["massBalance"]["variance"] == 670.0
        assert "Unexplained" in result["massBalance"]["note"]
        assert "KG" in result["massBalance"]["note"]

    def test_stock_section_is_source_truthful(self) -> None:
        """Stock buckets pass through from gold_batch_stock_v — no invention,
        no defaulting to KG (UOM comes from gold_material)."""
        result = build_batch_quality_passport(
            [_identity_row(unrestricted=100, blocked=50, quality_inspection=25)],
            [], [], [], []
        )
        assert result is not None
        assert result["stock"]["unrestricted"] == 100
        assert result["stock"]["blocked"] == 50
        assert result["stock"]["qualityInspection"] == 25
        assert result["stock"]["uom"] == "KG"

    def test_does_not_emit_signoff_key(self) -> None:
        """Post-PR-#82 rename: the response carries `usageDecisionEvidence`,
        never `signoff`. UI consumers MUST NOT see governance-language."""
        result = build_batch_quality_passport(
            [_identity_row()],
            [_coa_row()],
            [_lot_row()],
            [_summary_row()],
            [_balance_row()],
        )
        assert result is not None
        assert "signoff" not in result
        assert "usageDecisionEvidence" in result

    def test_does_not_emit_governed_release_authority_keys(self) -> None:
        """Forbidden-claims checklist: no canRelease, no releaseApproved,
        no sapPosting, no eSignature anywhere in the response."""
        result = build_batch_quality_passport(
            [_identity_row()], [_coa_row()], [_lot_row()], [_summary_row()], [_balance_row()]
        )
        import json

        as_json = json.dumps(result)
        for forbidden in ("canRelease", "releaseApproved", "sapPosting", "eSignature"):
            assert forbidden not in as_json, f"Forbidden key {forbidden!r} leaked into passport"


# ===========================================================================
# map_investigation_timeline_rows
# ===========================================================================


class TestMapInvestigationTimelineRows:
    """Timeline UNION mapper — coerces heterogeneous rows from mass-balance,
    quality-lot, and delivery sources into a uniform `TimelineEvent` shape."""

    def test_empty_rows_returns_empty_events_not_none(self) -> None:
        """An empty timeline is a VALID state (the batch may have no
        inspections / dispatches yet). The mapper MUST return {events: []}
        — never None, never 404."""
        assert map_investigation_timeline_rows([]) == {"events": []}

    def test_passes_through_known_event_type(self) -> None:
        rows = [
            {"ts": "2024-03-08T06:00", "event_type": "production", "label": "GR", "actor": "SAP", "detail": "17050 KG", "tone": "good", "source_system": "SAP"},
        ]
        result = map_investigation_timeline_rows(rows)
        assert result["events"][0]["type"] == "production"
        assert result["events"][0]["sourceSystem"] == "SAP"

    def test_unknown_event_type_coerced_to_note(self) -> None:
        """Drift-tolerant: if the SQL adds a new event_type the mapper hasn't
        seen, it falls back to 'note' rather than raising or leaking the
        unknown value to the contract."""
        rows = [
            {"ts": "2024-03-08T06:00", "event_type": "spurious-new-type", "label": "X", "actor": "SAP", "detail": "", "tone": "neutral"},
        ]
        result = map_investigation_timeline_rows(rows)
        assert result["events"][0]["type"] == "note"

    def test_unknown_tone_coerced_to_neutral(self) -> None:
        rows = [
            {"ts": "2024-03-08T06:00", "event_type": "production", "label": "X", "actor": "SAP", "detail": "", "tone": "pink"},
        ]
        result = map_investigation_timeline_rows(rows)
        assert result["events"][0]["tone"] == "neutral"

    def test_unknown_source_system_dropped_to_none(self) -> None:
        rows = [
            {"ts": "2024-03-08T06:00", "event_type": "production", "label": "X", "actor": "SAP", "detail": "", "tone": "good", "source_system": "GIBBERISH"},
        ]
        result = map_investigation_timeline_rows(rows)
        assert result["events"][0]["sourceSystem"] is None

    def test_blank_label_falls_back_to_event(self) -> None:
        rows = [
            {"ts": "2024-03-08T06:00", "event_type": "note", "label": "   ", "actor": "SAP", "detail": "", "tone": "neutral"},
        ]
        result = map_investigation_timeline_rows(rows)
        assert result["events"][0]["label"] == "Event"

    def test_blank_actor_falls_back_to_em_dash(self) -> None:
        """The contract requires a string actor. Use an em-dash sentinel so
        the UI can render an obvious 'no actor recorded' indicator."""
        rows = [
            {"ts": "2024-03-08T06:00", "event_type": "note", "label": "X", "actor": "", "detail": "", "tone": "neutral"},
        ]
        result = map_investigation_timeline_rows(rows)
        assert result["events"][0]["actor"] == "—"

    def test_preserves_row_order(self) -> None:
        """The SQL is responsible for ORDER BY ts; the mapper MUST NOT
        re-sort or drop rows."""
        rows = [
            {"ts": "2024-03-08T06:00", "event_type": "production", "label": "first",  "actor": "SAP", "detail": "", "tone": "good"},
            {"ts": "2024-03-09T06:00", "event_type": "qc",         "label": "second", "actor": "Lab", "detail": "", "tone": "good"},
            {"ts": "2024-03-10T06:00", "event_type": "dispatch",   "label": "third",  "actor": "SAP", "detail": "", "tone": "brand"},
        ]
        result = map_investigation_timeline_rows(rows)
        assert [e["label"] for e in result["events"]] == ["first", "second", "third"]

    @pytest.mark.parametrize("good_type", [
        "production", "consumption", "qc", "release", "approval", "hold", "dispatch", "note",
    ])
    def test_all_documented_event_types_pass_through(self, good_type: str) -> None:
        rows = [{"ts": "2024-03-08T06:00", "event_type": good_type, "label": "X", "actor": "A", "detail": "", "tone": "neutral"}]
        result = map_investigation_timeline_rows(rows)
        assert result["events"][0]["type"] == good_type

    @pytest.mark.parametrize("good_tone", ["good", "warn", "bad", "brand", "neutral"])
    def test_all_documented_tones_pass_through(self, good_tone: str) -> None:
        rows = [{"ts": "2024-03-08T06:00", "event_type": "note", "label": "X", "actor": "A", "detail": "", "tone": good_tone}]
        result = map_investigation_timeline_rows(rows)
        assert result["events"][0]["tone"] == good_tone

    @pytest.mark.parametrize("good_source", ["SAP", "LIMS", "TRACE", "MANUAL"])
    def test_all_documented_source_systems_pass_through(self, good_source: str) -> None:
        rows = [{"ts": "2024-03-08T06:00", "event_type": "note", "label": "X", "actor": "A", "detail": "", "tone": "neutral", "source_system": good_source}]
        result = map_investigation_timeline_rows(rows)
        assert result["events"][0]["sourceSystem"] == good_source
