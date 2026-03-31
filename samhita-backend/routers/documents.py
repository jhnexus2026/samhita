from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from models.document import get_db, Document, ClinicalEntity
from schemas.clinical import DocumentResponse
from services.pipeline import run_pipeline
from services import storage as supa_storage
import json
import os
import glob

router = APIRouter(prefix="/api", tags=["documents"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")


@router.get("/documents")
def list_documents(
    status: str = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Document).order_by(Document.created_at.desc())
    if status:
        query = query.filter(Document.status == status)
    docs = query.all()

    results = []
    for doc in docs:
        # --- Extract real patient name ---
        patient_name = None
        # Source 1: extracted_json (most reliable, straight from AI extraction)
        if doc.extracted_json:
            try:
                extracted = json.loads(doc.extracted_json)
                name = (extracted.get("patient_name") or "").strip()
                skip_names = {"", "unknown", "pasted patient data", "n/a", "na"}
                if name.lower() not in skip_names:
                    patient_name = name
            except Exception:
                pass
        # Source 2: PatientAlert table
        if not patient_name and doc.alerts:
            for alert in doc.alerts:
                if alert.patient_name and alert.patient_name.strip():
                    patient_name = alert.patient_name.strip()
                    break
        # Source 3: filename parsing (last resort)
        if not patient_name and " — " in doc.filename:
            patient_name = doc.filename.split(" — ")[0].strip()

        results.append({
            "id": doc.id,
            "filename": doc.filename,
            "doc_type": doc.doc_type or "general",
            "patient_name": patient_name or "Unknown Patient",
            "status": doc.status,
            "pipeline_step": doc.pipeline_step,
            "confidence_score": doc.confidence_score or 0,
            "page_count": doc.page_count or 1,
            "error_message": doc.error_message,
            "created_at": doc.created_at.isoformat() if doc.created_at else None,
            "updated_at": doc.updated_at.isoformat() if doc.updated_at else None,
        })
    return {"documents": results, "total": len(results)}


@router.get("/documents/{doc_id}")
def get_document(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")

    entities = db.query(ClinicalEntity).filter(ClinicalEntity.document_id == doc_id).all()

    # Discover page images for preview — prefer local files, fall back to Supabase
    page_images = []
    doc_dir = os.path.join(UPLOAD_DIR, str(doc_id))
    if os.path.isdir(doc_dir):
        # Local PNG page images
        for pg in sorted(glob.glob(os.path.join(doc_dir, "page_*.png"))):
            page_images.append(f"/uploads/{doc_id}/{os.path.basename(pg)}")
        # Also check for .txt files (text paste uploads)
        if not page_images:
            for tf in sorted(glob.glob(os.path.join(doc_dir, "*.txt"))):
                page_images.append(f"/uploads/{doc_id}/{os.path.basename(tf)}")
    # Fall back to Supabase if no local files
    if not page_images and supa_storage.is_enabled():
        for i in range(1, (doc.page_count or 1) + 1):
            url = supa_storage.get_public_url(f"{doc_id}/page_{i}.png")
            if url:
                page_images.append(url)

    return {
        "id": doc.id,
        "filename": doc.filename,
        "status": doc.status,
        "pipeline_step": doc.pipeline_step,
        "confidence_score": doc.confidence_score or 0,
        "page_count": doc.page_count or 1,
        "error_message": doc.error_message,
        "original_path": doc.original_path,
        "page_images": page_images,
        "extracted_data": json.loads(doc.extracted_json) if doc.extracted_json else None,
        "coded_data": json.loads(doc.coded_json) if doc.coded_json else None,
        "fhir_bundle": json.loads(doc.fhir_json) if doc.fhir_json else None,
        "ayushman_claim": json.loads(doc.ayushman_json) if doc.ayushman_json else None,
        "reconciliation_alerts": json.loads(doc.reconciliation_alerts) if doc.reconciliation_alerts else [],
        "entities": [
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
                "needs_review": e.needs_review,
                "reviewer_approved": e.reviewer_approved,
            }
            for e in entities
        ],
        "created_at": doc.created_at.isoformat() if doc.created_at else None,
        "updated_at": doc.updated_at.isoformat() if doc.updated_at else None,
    }


@router.post("/documents/{doc_id}/retry")
def retry_document(
    doc_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Retry processing for a failed or errored document."""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")

    if doc.status not in ("error", "needs_review"):
        raise HTTPException(400, f"Document status is '{doc.status}', cannot retry")

    # Clear previous entities if retrying from scratch
    db.query(ClinicalEntity).filter(ClinicalEntity.document_id == doc_id).delete()
    doc.status = "queued"
    doc.pipeline_step = "upload"
    doc.error_message = None
    doc.coded_json = None
    doc.fhir_json = None
    doc.ayushman_json = None
    doc.reconciliation_alerts = None
    doc.confidence_score = 0
    db.commit()

    # Rediscover page images
    doc_dir = os.path.join(UPLOAD_DIR, str(doc_id))
    page_paths = sorted(glob.glob(os.path.join(doc_dir, "page_*.png")))

    if not page_paths:
        raise HTTPException(400, "No page images found for this document. Re-upload required.")

    background_tasks.add_task(run_pipeline, doc_id, page_paths)

    return {
        "id": doc.id,
        "status": "queued",
        "message": "Document re-queued for processing",
    }


@router.get("/documents/{doc_id}/accuracy")
def get_document_accuracy(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")

    entities = db.query(ClinicalEntity).filter(ClinicalEntity.document_id == doc_id).all()
    total = len(entities)
    if total == 0:
        return {"document_id": doc_id, "total_entities": 0, "accuracy": {}}

    high = sum(1 for e in entities if e.confidence >= 0.85)
    medium = sum(1 for e in entities if 0.5 <= e.confidence < 0.85)
    low = sum(1 for e in entities if e.confidence < 0.5)

    return {
        "document_id": doc_id,
        "total_entities": total,
        "overall_confidence": doc.confidence_score or 0,
        "accuracy": {
            "high_confidence": {"count": high, "percentage": round(high / total * 100, 1)},
            "medium_confidence": {"count": medium, "percentage": round(medium / total * 100, 1)},
            "low_confidence": {"count": low, "percentage": round(low / total * 100, 1)},
        },
        "needs_review_count": sum(1 for e in entities if e.needs_review),
        "reviewed_count": sum(1 for e in entities if e.reviewer_approved is not None),
    }


@router.get("/documents/{doc_id}/explanations")
def get_document_explanations(doc_id: int, db: Session = Depends(get_db)):
    """Get plain-language explanations for all coded entities in a document."""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")

    entities = db.query(ClinicalEntity).filter(ClinicalEntity.document_id == doc_id).all()
    entity_dicts = [
        {
            "id": e.id,
            "entity_text": e.entity_text,
            "entity_type": e.entity_type,
            "coded_value": e.coded_value,
            "code_system": e.code_system,
            "code_description": e.code_description,
        }
        for e in entities
        if e.coded_value
    ]

    from services.explainer import get_explanations_batch
    explained = get_explanations_batch(entity_dicts)
    return {"document_id": doc_id, "explanations": explained}


@router.get("/explain/{code}")
def explain_code(code: str, code_system: str = "ICD-10", description: str = ""):
    """Get a plain-language explanation for a single medical code."""
    from services.explainer import get_explanation
    result = get_explanation(code, code_system, description)
    return {"code": code, "code_system": code_system, **result}

