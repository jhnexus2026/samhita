from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models.document import get_db, PatientAlert
from datetime import datetime

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("")
def list_alerts(db: Session = Depends(get_db)):
    """List all patient alerts, most recent first."""
    alerts = db.query(PatientAlert).order_by(PatientAlert.created_at.desc()).all()
    return {
        "alerts": [
            {
                "id": a.id,
                "document_id": a.document_id,
                "patient_name": a.patient_name,
                "severity": a.severity,
                "flagged_findings": a.flagged_findings,
                "acknowledged": a.acknowledged,
                "acknowledged_by": a.acknowledged_by,
                "acknowledged_at": a.acknowledged_at.isoformat() if a.acknowledged_at else None,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in alerts
        ],
        "total": len(alerts),
        "unacknowledged": sum(1 for a in alerts if not a.acknowledged),
    }


@router.patch("/{alert_id}/acknowledge")
def acknowledge_alert(
    alert_id: int,
    db: Session = Depends(get_db),
):
    """Doctor acknowledges a critical patient alert."""
    alert = db.query(PatientAlert).filter(PatientAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(404, "Alert not found")

    alert.acknowledged = True
    alert.acknowledged_by = "admin"  # TODO: get from auth
    alert.acknowledged_at = datetime.utcnow()
    db.commit()

    return {
        "id": alert.id,
        "acknowledged": True,
        "message": "Alert acknowledged successfully",
    }
