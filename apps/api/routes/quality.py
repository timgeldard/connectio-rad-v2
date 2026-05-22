import os
from datetime import datetime, timezone
from fastapi import APIRouter, Header, HTTPException, Response
from contracts.generated import QualityEvidenceRequest, QualityEvidenceResponse, QualityEvidenceSummary

from adapters.quality.quality_databricks_adapter import (
    get_quality_usage_decision_spec,
    map_quality_usage_decision_rows,
)
from routes._databricks import (
    build_user_identity,
    require_databricks_config,
)
from shared.query_service.query_executor import run_query

router = APIRouter(prefix="/quality", tags=["quality"])

@router.post("/read-only-evidence", response_model=QualityEvidenceResponse)
async def get_read_only_evidence(
    request: QualityEvidenceRequest,
    response: Response,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> QualityEvidenceResponse:
    """
    Read-only Quality evidence route.
    
    Fetches raw source evidence directly from Databricks (gold_inspection_usage_decision).
    This evidence is strictly read-only and governed under Option A (Strict Lot-Level Evidence).
    It must not be used to synthesise a batch-level release decision.
    """
    queried_at = datetime.now(timezone.utc).isoformat()
    adapter_mode = os.getenv("BACKEND_ADAPTER_MODE", "")
    
    if adapter_mode != "databricks-api":
        # Return the unavailable skeleton if not configured for native Databricks.
        return QualityEvidenceResponse(
            request=request,
            summary=QualityEvidenceSummary(
                source='unavailable',
                status='unavailable',
                inspectionLotCount=0,
                micResultCount=0,
                usageDecisionStatus='unavailable',
                coaResultCount=0,
                unavailableEvidence=[
                    'inspection-lots',
                    'mic-results',
                    'usage-decision',
                    'coa-results',
                    'deviations'
                ],
                warnings=[
                    'Quality evidence requires BACKEND_ADAPTER_MODE=databricks-api.',
                ],
                queriedAt=queried_at,
                sourceFreshnessStatus='not-verified'
            ),
            inspectionLots=[],
            micResults=[],
            usageDecision=None,
            coaResults=[]
        )

    # We need batch_id and material_id to query usage decisions reliably at the batch level.
    if not request.batch_id or not request.material_id:
        raise HTTPException(status_code=422, detail="batchId and materialId are required for quality evidence")

    host, warehouse_id = require_databricks_config()
    identity = build_user_identity(
        x_forwarded_access_token, x_forwarded_user, x_forwarded_email
    )

    rows, _ = await run_query(
        lambda: get_quality_usage_decision_spec(request.material_id, request.batch_id, request.plant_id),
        identity,
        host,
        warehouse_id,
    )

    inspection_lots, summary = map_quality_usage_decision_rows(rows, queried_at)

    return QualityEvidenceResponse(
        request=request,
        summary=summary,
        inspectionLots=inspection_lots,
        micResults=[],
        usageDecision=None,
        coaResults=[]
    )
