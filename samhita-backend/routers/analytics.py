from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from models.document import get_db, Document, ClinicalEntity
from schemas.clinical import MetricsResponse, RevenueAnalyticsResponse
import json

router = APIRouter(prefix="/api", tags=["analytics"])


@router.get("/metrics", response_model=MetricsResponse)
def get_metrics(db: Session = Depends(get_db)):
    """System-wide accuracy and processing metrics."""
    total = db.query(Document).count()
    processed = db.query(Document).filter(Document.status == "done").count()
    in_queue = db.query(Document).filter(Document.status.in_(["queued", "processing", "extracting", "analyzing", "mapping", "structuring", "reconciling"])).count()
    needs_review = db.query(Document).filter(Document.status == "needs_review").count()

    avg_conf = db.query(func.avg(Document.confidence_score)).filter(Document.status.in_(["done", "needs_review"])).scalar() or 0

    # Entity-level confidence breakdown
    all_entities = db.query(ClinicalEntity).all()
    entity_total = len(all_entities)
    if entity_total > 0:
        high = sum(1 for e in all_entities if e.confidence >= 0.85) / entity_total * 100
        medium = sum(1 for e in all_entities if 0.5 <= e.confidence < 0.85) / entity_total * 100
        low = sum(1 for e in all_entities if e.confidence < 0.5) / entity_total * 100
    else:
        high = medium = low = 0

    return MetricsResponse(
        total_documents=total,
        documents_processed=processed,
        documents_in_queue=in_queue,
        documents_needs_review=needs_review,
        average_confidence=round(avg_conf, 3),
        high_confidence_pct=round(high, 1),
        medium_confidence_pct=round(medium, 1),
        low_confidence_pct=round(low, 1),
    )


@router.get("/revenue-analytics", response_model=RevenueAnalyticsResponse)
def get_revenue_analytics(db: Session = Depends(get_db)):
    """Revenue impact from billing reconciliation."""
    docs = db.query(Document).filter(Document.reconciliation_alerts.isnot(None)).all()

    total_missed = 0.0
    total_phantom = 0.0
    total_alerts = 0
    per_doc = []

    for doc in docs:
        try:
            alerts = json.loads(doc.reconciliation_alerts) if doc.reconciliation_alerts else []
        except json.JSONDecodeError:
            alerts = []

        doc_missed = sum(a.get("estimated_impact", 0) for a in alerts if a.get("alert_type") == "MISSED_CHARGE")
        doc_phantom = sum(a.get("estimated_impact", 0) for a in alerts if a.get("alert_type") == "PHANTOM_BILLING")

        total_missed += doc_missed
        total_phantom += doc_phantom
        total_alerts += len(alerts)

        if alerts:
            per_doc.append({
                "document_id": doc.id,
                "filename": doc.filename,
                "missed_revenue": doc_missed,
                "phantom_billed": doc_phantom,
                "alert_count": len(alerts),
            })

    return RevenueAnalyticsResponse(
        total_missed_revenue=round(total_missed, 2),
        total_phantom_billed=round(total_phantom, 2),
        net_revenue_impact=round(total_missed - total_phantom, 2),
        total_alerts=total_alerts,
        documents_with_issues=len(per_doc),
        per_document=per_doc,
    )
