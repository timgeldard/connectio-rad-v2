from dataclasses import dataclass
from typing import Optional
from datetime import datetime, timezone

from shared.query_service.query_spec import QuerySpec
from contracts.generated import (
    QualityEvidenceResponse,
    QualityEvidenceSummary,
    QualityInspectionLotEvidence,
)

# Governed UD Labels (Option A)
UD_LABELS = {
    "A": "Accepted",
    "AE": "Accepted (variant / EM)",
    "AC": "Accepted with concession",
    "ACE": "Accepted with concession (variant / EM)",
    "A9": "Accepted — batch restricted",
    "R": "Rejected",
    "RE": "Rejected (variant / EM)",
    "RR": "Rejected — batch restricted globally",
    "": "Pending — lot open, stock in QI, no decision taken",
}

@dataclass
class QualityUsageDecisionQuerySpec(QuerySpec):
    material_id: str
    batch_id: str
    plant_id: Optional[str] = None
    
    def cache_key(self) -> str:
        return f"quality_ud:{self.material_id}:{self.batch_id}:{self.plant_id or 'none'}"

def get_quality_usage_decision_spec(material_id: str, batch_id: str, plant_id: Optional[str] = None) -> QuerySpec:
    sql = """
    WITH usage_decision_ranked AS (
      SELECT
        ud.INSPECTION_LOT_ID,
        ud.USAGE_DECISION_CODE,
        ud.USAGE_DECISION_CREATED_DATE,
        ud.USAGE_DECISION_UPDATED_TIME,
        il.MATERIAL_ID,
        il.BATCH_ID,
        il.PLANT_ID,
        il.PROCESS_ORDER_ID,
        ROW_NUMBER() OVER (
          PARTITION BY ud.INSPECTION_LOT_ID
          ORDER BY
            COALESCE(CAST(NULLIF(ud.USAGE_DECISION_COUNTER, '') AS INT), 0) DESC,
            ud.USAGE_DECISION_CREATED_DATE DESC,
            ud.USAGE_DECISION_UPDATED_TIME DESC
        ) AS rn
      FROM connected_plant_uat.gold.gold_inspection_usage_decision ud
      LEFT JOIN connected_plant_uat.gold.gold_inspection_lot il
        ON il.INSPECTION_LOT_ID = ud.INSPECTION_LOT_ID
    )
    SELECT
      udr.INSPECTION_LOT_ID,
      udr.USAGE_DECISION_CODE,
      udr.USAGE_DECISION_CREATED_DATE,
      udr.MATERIAL_ID,
      udr.BATCH_ID,
      udr.PLANT_ID,
      udr.PROCESS_ORDER_ID
    FROM usage_decision_ranked udr
    WHERE udr.rn = 1
      AND udr.MATERIAL_ID = :material_id
      AND udr.BATCH_ID = :batch_id
    """
    
    if plant_id:
        sql += " AND udr.PLANT_ID = :plant_id"

    return QualityUsageDecisionQuerySpec(
        sql=sql,
        params={"material_id": material_id, "batch_id": batch_id, "plant_id": plant_id},
        material_id=material_id,
        batch_id=batch_id,
        plant_id=plant_id
    )

def map_quality_usage_decision_rows(rows: list[dict], queried_at: str) -> tuple[list[QualityInspectionLotEvidence], QualityEvidenceSummary]:
    inspection_lots = []
    
    for row in rows:
        lot_id = row.get("INSPECTION_LOT_ID")
        if not lot_id:
            continue
            
        raw_code = row.get("USAGE_DECISION_CODE")
        if raw_code is None:
            raw_code = ""

        governed_label = UD_LABELS.get(raw_code, f"Unknown ({raw_code})")
        
        created_dt = row.get("USAGE_DECISION_CREATED_DATE")
        # Format date as ISO string if present
        created_str = str(created_dt) if created_dt else None
        
        lot_evidence = QualityInspectionLotEvidence(
            inspectionLotId=str(lot_id),
            materialId=str(row.get("MATERIAL_ID")) if row.get("MATERIAL_ID") else None,
            batchId=str(row.get("BATCH_ID")) if row.get("BATCH_ID") else None,
            plantId=str(row.get("PLANT_ID")) if row.get("PLANT_ID") else None,
            processOrderId=str(row.get("PROCESS_ORDER_ID")) if row.get("PROCESS_ORDER_ID") else None,
            source='databricks-api',
            usageDecisionCode=str(raw_code),
            usageDecisionText=governed_label,
            usageDecisionMappingStatus='verified',
            usageDecisionCreatedAt=created_str
        )
        inspection_lots.append(lot_evidence)

    lot_count = len(inspection_lots)
    
    multiple_lots_warning = None
    missing_lot_warning = None
    
    if lot_count > 1:
        multiple_lots_warning = "Multiple inspection lots found — showing per-lot evidence. A single batch decision cannot be derived without a governed lot-selection rule."
    elif lot_count == 0:
        missing_lot_warning = "No inspection lot found for this batch"

    summary = QualityEvidenceSummary(
        source='databricks-api',
        status='loaded' if lot_count > 0 else 'no-records',
        inspectionLotCount=lot_count,
        micResultCount=0,
        usageDecisionStatus='source-present' if lot_count > 0 else 'not-found',
        coaResultCount=0,
        unavailableEvidence=[
            'mic-results',
            'coa-results',
            'deviations'
        ],
        warnings=[],
        queriedAt=queried_at,
        sourceFreshnessStatus='unknown',
        lotCount=lot_count,
        multipleLotsWarning=multiple_lots_warning,
        missingLotWarning=missing_lot_warning
    )
    
    return inspection_lots, summary
