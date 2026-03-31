from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.orm import Session
from models.document import get_db, Document, ClinicalEntity
import json
import csv
import io

router = APIRouter(prefix="/api/export", tags=["export"])


@router.get("/fhir/{doc_id}")
def export_fhir(doc_id: int, db: Session = Depends(get_db)):
    """Export FHIR R4 Bundle JSON for a document."""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    if not doc.fhir_json:
        raise HTTPException(400, "FHIR bundle not yet generated. Document may still be processing.")

    fhir_data = json.loads(doc.fhir_json)
    return JSONResponse(
        content=fhir_data,
        headers={"Content-Disposition": f'attachment; filename="fhir_bundle_{doc_id}.json"'},
    )


@router.get("/ayushman/{doc_id}")
def export_ayushman(doc_id: int, db: Session = Depends(get_db)):
    """Export Ayushman PMJAY claims JSON."""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    if not doc.ayushman_json:
        raise HTTPException(400, "Ayushman claim not yet generated.")

    claim_data = json.loads(doc.ayushman_json)
    return JSONResponse(
        content=claim_data,
        headers={"Content-Disposition": f'attachment; filename="ayushman_claim_{doc_id}.json"'},
    )


@router.get("/csv/{doc_id}")
def export_csv(doc_id: int, db: Session = Depends(get_db)):
    """Export entities as flat CSV."""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")

    entities = db.query(ClinicalEntity).filter(ClinicalEntity.document_id == doc_id).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "entity_type", "entity_text", "normalized_value",
        "coded_value", "code_system", "code_description",
        "confidence", "negated", "needs_review", "reviewer_approved",
    ])

    for e in entities:
        writer.writerow([
            e.entity_type, e.entity_text, e.normalized_value,
            e.coded_value, e.code_system, e.code_description,
            e.confidence, e.negated, e.needs_review, e.reviewer_approved,
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="entities_{doc_id}.csv"'},
    )


@router.get("/pdf/{doc_id}")
def export_pdf(doc_id: int, db: Session = Depends(get_db)):
    """Export a summarized clinical report PDF."""
    from services.pdf_generator import generate_document_pdf

    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")

    entities = db.query(ClinicalEntity).filter(ClinicalEntity.document_id == doc_id).all()

    # Parse extracted data for summary
    extracted_data = {}
    if doc.extracted_json:
        try:
            extracted_data = json.loads(doc.extracted_json)
        except Exception:
            pass

    # Parse reconciliation alerts
    recon_alerts = []
    if doc.reconciliation_alerts:
        try:
            recon_alerts = json.loads(doc.reconciliation_alerts)
        except Exception:
            pass

    doc_data = {
        "filename": doc.filename,
        "doc_type": doc.doc_type or "general",
        "status": doc.status,
        "pipeline_step": doc.pipeline_step,
        "confidence_score": doc.confidence_score,
        "page_count": doc.page_count,
        "created_at": str(doc.created_at) if doc.created_at else None,
        "updated_at": str(doc.updated_at) if doc.updated_at else None,
        "reconciliation_alerts": recon_alerts,
    }

    entities_data = [
        {
            "entity_type": e.entity_type,
            "entity_text": e.entity_text,
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
    ]

    pdf_bytes = generate_document_pdf(doc_data, entities_data, extracted_data)

    if not pdf_bytes:
        raise HTTPException(500, "PDF generation failed — PyMuPDF may not be installed")

    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="summary_{doc_id}.pdf"'},
    )


@router.get("/fhir-pdf/{doc_id}")
def export_fhir_pdf(doc_id: int, db: Session = Depends(get_db)):
    """Export FHIR R4 Bundle as a human-readable PDF."""
    from services.pdf_generator import generate_fhir_pdf

    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    if not doc.fhir_json:
        raise HTTPException(400, "FHIR bundle not yet generated. Document may still be processing.")

    fhir_data = json.loads(doc.fhir_json)
    doc_data = {
        "filename": doc.filename,
        "doc_type": doc.doc_type or "general",
    }

    pdf_bytes = generate_fhir_pdf(fhir_data, doc_data)

    if not pdf_bytes:
        raise HTTPException(500, "PDF generation failed — PyMuPDF may not be installed")

    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="fhir_report_{doc_id}.pdf"'},
    )
