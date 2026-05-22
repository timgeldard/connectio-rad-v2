import pytest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

@pytest.fixture
def mock_run_query():
    with patch("routes.quality.run_query", new_callable=AsyncMock) as mock:
        yield mock

def test_get_read_only_evidence_databricks(mock_run_query, monkeypatch):
    monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
    
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

def test_get_read_only_evidence_unavailable_if_not_databricks(monkeypatch):
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
    assert data["summary"]["source"] == "unavailable"
    assert data["summary"]["status"] == "unavailable"
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
