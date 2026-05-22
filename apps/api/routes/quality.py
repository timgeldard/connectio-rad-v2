from datetime import datetime, timezone
from fastapi import APIRouter
from contracts.generated import QualityEvidenceRequest, QualityEvidenceResponse, QualityEvidenceSummary

router = APIRouter(prefix="/quality", tags=["quality"])

@router.post("/read-only-evidence", response_model=QualityEvidenceResponse)
async def get_read_only_evidence(request: QualityEvidenceRequest) -> QualityEvidenceResponse:
    """
    Read-only Quality evidence skeleton route.
    
    This route intentionally does not fetch from Databricks. It returns a contract-valid
    unavailable response so the UI can represent the read-only evidence state honestly
    without assuming live records or decision-making authority.
    """
    queried_at = datetime.now(timezone.utc).isoformat()
    
    return QualityEvidenceResponse(
        request=request,
        summary=QualityEvidenceSummary(
            source='databricks-api',
            status='pending-source-verification',
            inspectionLotCount=0,
            micResultCount=0,
            usageDecisionStatus='source-unverified',
            coaResultCount=0,
            unavailableEvidence=[
                'inspection-lots',
                'mic-results',
                'usage-decision',
                'coa-results',
                'deviations'
            ],
            warnings=[
                'Read-only Quality evidence is pending Databricks source verification.',
                'Missing usage-decision evidence must not be interpreted as accepted or released.',
                'No-record sections must not be interpreted as proof of absence until source coverage is validated.',
                'CoA-like result evidence is not official CoA document approval.'
            ],
            queriedAt=queried_at,
            sourceFreshnessStatus='not-verified'
        ),
        inspectionLots=[],
        micResults=[],
        usageDecision=None,
        coaResults=[]
    )
