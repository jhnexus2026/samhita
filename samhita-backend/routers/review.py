from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models.document import get_db, Document, ClinicalEntity
from schemas.clinical import EntityUpdateRequest
from datetime import datetime

router = APIRouter(prefix="/api", tags=["review"])


@router.get("/review-queue")
def get_review_queue(db: Session = Depends(get_db)):
    """Get documents that have entities needing human review."""
    docs_with_reviews = (
        db.query(Document)
        .filter(Document.status.in_(["needs_review", "done"]))
        .order_by(Document.created_at.desc())
        .all()
    )

    results = []
    for doc in docs_with_reviews:
        review_entities = (
            db.query(ClinicalEntity)
            .filter(
                ClinicalEntity.document_id == doc.id,
                ClinicalEntity.needs_review == True,
                ClinicalEntity.reviewer_approved == None,
            )
            .all()
        )
        if review_entities:
            results.append({
                "document": {
                    "id": doc.id,
                    "filename": doc.filename,
                    "status": doc.status,
                    "original_path": doc.original_path,
                    "confidence_score": doc.confidence_score or 0,
                },
                "entities_to_review": [
                    {
                        "id": e.id,
                        "entity_text": e.entity_text,
                        "entity_type": e.entity_type,
                        "normalized_value": e.normalized_value,
                        "coded_value": e.coded_value,
                        "code_system": e.code_system,
                        "code_description": e.code_description,
                        "confidence": e.confidence,
                        "negated": e.negated,
                    }
                    for e in review_entities
                ],
                "review_count": len(review_entities),
            })

    return {"review_queue": results, "total": len(results)}


@router.patch("/entities/{entity_id}")
def update_entity(
    entity_id: int,
    update: EntityUpdateRequest,
    db: Session = Depends(get_db),
):
    """Approve, reject, or override an extracted entity."""
    entity = db.query(ClinicalEntity).filter(ClinicalEntity.id == entity_id).first()
    if not entity:
        raise HTTPException(404, "Entity not found")

    if update.reviewer_approved is not None:
        entity.reviewer_approved = update.reviewer_approved
        entity.reviewed_at = datetime.utcnow()
        entity.reviewed_by = "admin"  # TODO: get from auth
        if update.reviewer_approved:
            entity.needs_review = False

    if update.coded_value is not None:
        entity.coded_value = update.coded_value
    if update.code_system is not None:
        entity.code_system = update.code_system
    if update.entity_text is not None:
        entity.entity_text = update.entity_text
    if update.normalized_value is not None:
        entity.normalized_value = update.normalized_value

    db.commit()
    db.refresh(entity)

    # Check if all review entities for this doc are resolved
    doc = db.query(Document).filter(Document.id == entity.document_id).first()
    pending_reviews = (
        db.query(ClinicalEntity)
        .filter(
            ClinicalEntity.document_id == entity.document_id,
            ClinicalEntity.needs_review == True,
            ClinicalEntity.reviewer_approved == None,
        )
        .count()
    )
    if pending_reviews == 0 and doc.status == "needs_review":
        doc.status = "done"
        db.commit()

    return {
        "id": entity.id,
        "entity_text": entity.entity_text,
        "reviewer_approved": entity.reviewer_approved,
        "needs_review": entity.needs_review,
        "message": "Entity updated successfully",
    }
