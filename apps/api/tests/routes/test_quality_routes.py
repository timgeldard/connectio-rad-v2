import pytest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

@pytest.fixture
def mock_run_query():
    with patch("routes.quality.run_query", new_callable=AsyncMock) as mock:
        yield mock

def _databricks_env(monkeypatch) -> None:
    """Minimum env required by `require_databricks_config()`."""
    monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
    monkeypatch.setenv("DATABRICKS_HOST", "test.databricks.com")
    monkeypatch.setenv("SQL_WAREHOUSE_ID", "wh-test")


def test_get_read_only_evidence_databricks(mock_run_query, monkeypatch):
    _databricks_env(monkeypatch)

    mock_run_query.return_value = (
        [
            {
                "INSPECTION_LOT_ID": "123",
                "USAGE_DECISION_CODE": "A"
            }
        ],
        None
    )

    response = client.post(
        "/api/quality/read-only-evidence",
        json={
            "materialId": "MAT1",
            "batchId": "BATCH1"
        }
    )

    assert response.status_code == 200
    data = response.json()
    assert data["summary"]["source"] == "databricks-api"
    assert data["summary"]["inspectionLotCount"] == 1
    assert data["summary"]["status"] == "loaded"

    lots = data["inspectionLots"]
    assert len(lots) == 1
    assert lots[0]["inspectionLotId"] == "123"
    assert lots[0]["usageDecisionCode"] == "A"
    assert lots[0]["usageDecisionText"] == "Accepted"

def test_get_read_only_evidence_pending_source_verification_if_not_databricks(monkeypatch):
    """When BACKEND_ADAPTER_MODE is not 'databricks-api', the route MUST NOT
    claim `source: 'unavailable'`. The intended source is still Databricks;
    the readiness state is `pending-source-verification`.
    """
    monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")

    response = client.post(
        "/api/quality/read-only-evidence",
        json={
            "materialId": "MAT1",
            "batchId": "BATCH1"
        }
    )

    assert response.status_code == 200
    data = response.json()
    assert data["summary"]["source"] == "databricks-api"
    assert data["summary"]["status"] == "pending-source-verification"
    assert any(
        "not be interpreted as accepted or released" in w
        for w in data["summary"]["warnings"]
    )
    assert len(data["inspectionLots"]) == 0

def test_get_read_only_evidence_requires_batch_and_material(monkeypatch):
    monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")

    response = client.post(
        "/api/quality/read-only-evidence",
        json={
            "materialId": "MAT1"
            # Missing batchId
        }
    )

    assert response.status_code == 422
    assert "batchId and materialId are required" in response.json()["detail"]


# ---------------------------------------------------------------------------
# POST /api/quality/read-only-evidence — response_model contract enforcement
# ---------------------------------------------------------------------------


class TestQualityReadOnlyEvidenceResponseModel:
    """Prove that POST /api/quality/read-only-evidence is enforced through
    the generated QualityEvidenceResponse contract on both paths:
    databricks-api (live data) AND mode-guard (pending-source-verification).
    """

    def test_databricks_path_validates_against_generated_contract(self, mock_run_query, monkeypatch):
        from contracts.generated import QualityEvidenceResponse

        _databricks_env(monkeypatch)
        mock_run_query.return_value = (
            [{"INSPECTION_LOT_ID": "100", "USAGE_DECISION_CODE": "A"}],
            None,
        )
        response = client.post(
            "/api/quality/read-only-evidence",
            json={"materialId": "MAT1", "batchId": "BATCH1"},
        )
        assert response.status_code == 200
        # Round-trip through the generated model — any leaked unmodeled key
        # would fail Pydantic validation here.
        QualityEvidenceResponse.model_validate(response.json())

    def test_pending_source_verification_path_validates_against_generated_contract(self, monkeypatch):
        """The mode-guard unavailable-skeleton MUST also validate against
        QualityEvidenceResponse — same wire-shape as the live path."""
        from contracts.generated import QualityEvidenceResponse

        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")
        response = client.post(
            "/api/quality/read-only-evidence",
            json={"materialId": "MAT1", "batchId": "BATCH1"},
        )
        assert response.status_code == 200
        QualityEvidenceResponse.model_validate(response.json())

    def test_multi_lot_preserves_warning_and_validates(self, mock_run_query, monkeypatch):
        from contracts.generated import QualityEvidenceResponse

        _databricks_env(monkeypatch)
        mock_run_query.return_value = (
            [
                {"INSPECTION_LOT_ID": "100", "USAGE_DECISION_CODE": "A"},
                {"INSPECTION_LOT_ID": "101", "USAGE_DECISION_CODE": "R"},
            ],
            None,
        )
        response = client.post(
            "/api/quality/read-only-evidence",
            json={"materialId": "MAT1", "batchId": "BATCH1"},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["inspectionLots"]) == 2
        warning = data["summary"]["multipleLotsWarning"]
        assert warning is not None
        assert "Multiple inspection lots" in warning
        QualityEvidenceResponse.model_validate(data)

    def test_unknown_code_surfaces_as_unverified(self, mock_run_query, monkeypatch):
        _databricks_env(monkeypatch)
        mock_run_query.return_value = (
            [{"INSPECTION_LOT_ID": "100", "USAGE_DECISION_CODE": "MYSTERY"}],
            None,
        )
        response = client.post(
            "/api/quality/read-only-evidence",
            json={"materialId": "MAT1", "batchId": "BATCH1"},
        )
        assert response.status_code == 200
        lot = response.json()["inspectionLots"][0]
        assert lot["usageDecisionMappingStatus"] == "unverified"
        assert lot["usageDecisionText"] == "Unknown (MYSTERY)"

    def test_null_code_surfaces_as_not_mapped(self, mock_run_query, monkeypatch):
        _databricks_env(monkeypatch)
        mock_run_query.return_value = (
            [{"INSPECTION_LOT_ID": "100", "USAGE_DECISION_CODE": None}],
            None,
        )
        response = client.post(
            "/api/quality/read-only-evidence",
            json={"materialId": "MAT1", "batchId": "BATCH1"},
        )
        assert response.status_code == 200
        lot = response.json()["inspectionLots"][0]
        assert lot["usageDecisionMappingStatus"] == "not-mapped"

    def test_no_batch_level_release_or_approval_fields(self, mock_run_query, monkeypatch):
        """QualityEvidenceResponse is strictly lot-level (Option A). The
        wire response MUST NOT carry batch-level release / approved /
        cleared / safe fields."""
        _databricks_env(monkeypatch)
        mock_run_query.return_value = (
            [{"INSPECTION_LOT_ID": "100", "USAGE_DECISION_CODE": "A"}],
            None,
        )
        response = client.post(
            "/api/quality/read-only-evidence",
            json={"materialId": "MAT1", "batchId": "BATCH1"},
        )
        body = response.json()
        # Top-level forbidden fields.
        for forbidden in (
            "released", "approved", "cleared", "safe", "recallRecommended",
            "batchReleased", "approvedForShipment", "signoff",
        ):
            assert forbidden not in body
        # Summary-level too.
        for forbidden in ("released", "approved", "cleared", "safe", "recallRecommended"):
            assert forbidden not in body["summary"]
        # Each lot also stays lot-level.
        for lot in body["inspectionLots"]:
            for forbidden in ("batchReleased", "released", "approved", "cleared", "safe"):
                assert forbidden not in lot

    def test_databricks_path_does_not_fall_back_to_mock(self, monkeypatch):
        """If BACKEND_ADAPTER_MODE=databricks-api but run_query raises
        DatabricksQueryError, the route MUST NOT silently return a mock
        success — it must propagate the upstream failure."""
        from fastapi import HTTPException

        _databricks_env(monkeypatch)
        with patch("routes.quality.run_query", new_callable=AsyncMock) as mock:
            mock.side_effect = HTTPException(status_code=502, detail="Databricks query execution failed")
            response = client.post(
                "/api/quality/read-only-evidence",
                json={"materialId": "MAT1", "batchId": "BATCH1"},
            )
        # 502 from run_query's translation. Must NOT be 200 with mock-shaped data.
        assert response.status_code == 502


# ---------------------------------------------------------------------------
# Lot identifier wire-shape (PR 6 — identifier preservation)
# ---------------------------------------------------------------------------


class TestQualityLotIdentifiersOnWire:
    """Verify that materialId, batchId, plantId, processOrderId are
    preserved on the wire when source rows carry them. These identifiers
    are the traceability anchors between the inspection lot and the batch
    under investigation."""

    def test_lot_identifiers_on_wire(self, mock_run_query, monkeypatch):
        _databricks_env(monkeypatch)
        mock_run_query.return_value = (
            [
                {
                    "INSPECTION_LOT_ID": "LOT-FULL",
                    "USAGE_DECISION_CODE": "A",
                    "MATERIAL_ID": "000000000020582002",
                    "BATCH_ID": "0008898869",
                    "PLANT_ID": "C351",
                    "PROCESS_ORDER_ID": "PO-2024-03-0847",
                    "USAGE_DECISION_CREATED_DATE": "2024-03-09T11:42:00",
                }
            ],
            None,
        )
        response = client.post(
            "/api/quality/read-only-evidence",
            json={"materialId": "000000000020582002", "batchId": "0008898869", "plantId": "C351"},
        )
        assert response.status_code == 200
        lot = response.json()["inspectionLots"][0]
        assert lot["inspectionLotId"] == "LOT-FULL"
        assert lot["materialId"] == "000000000020582002"
        assert lot["batchId"] == "0008898869"
        assert lot["plantId"] == "C351"
        assert lot["processOrderId"] == "PO-2024-03-0847"

    def test_no_snake_case_keys_in_lots(self, mock_run_query, monkeypatch):
        """All lot keys on the wire must use camelCase aliases — no snake_case leak."""
        _databricks_env(monkeypatch)
        mock_run_query.return_value = (
            [{"INSPECTION_LOT_ID": "LOT-1", "USAGE_DECISION_CODE": "A"}],
            None,
        )
        response = client.post(
            "/api/quality/read-only-evidence",
            json={"materialId": "MAT1", "batchId": "BATCH1"},
        )
        assert response.status_code == 200
        lot = response.json()["inspectionLots"][0]
        for snake in (
            "inspection_lot_id", "material_id", "batch_id", "plant_id",
            "process_order_id", "usage_decision_code", "usage_decision_text",
            "usage_decision_mapping_status", "usage_decision_created_at",
        ):
            assert snake not in lot, f"snake_case key leaked to wire: {snake}"

    def test_missing_lot_warning_on_empty_result(self, mock_run_query, monkeypatch):
        """When Databricks returns zero rows, the summary must carry
        missingLotWarning so the UI cannot silently show 'no lots' as
        a clean/cleared state."""
        _databricks_env(monkeypatch)
        mock_run_query.return_value = ([], None)
        response = client.post(
            "/api/quality/read-only-evidence",
            json={"materialId": "MAT1", "batchId": "BATCH1"},
        )
        assert response.status_code == 200
        summary = response.json()["summary"]
        assert summary["missingLotWarning"] is not None
        assert summary["status"] == "no-records"
        assert summary["usageDecisionStatus"] == "not-found"
