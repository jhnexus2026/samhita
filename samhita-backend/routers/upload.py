# Reload trigger: 2026-03-28T19:00
from fastapi import APIRouter, UploadFile, File, BackgroundTasks, Depends, HTTPException, Form
from sqlalchemy.orm import Session
import os
import shutil
import logging
import fitz  # PyMuPDF
from PIL import Image
from models.document import get_db, Document, Case, Patient, PreAuth, StateTransition
from services.pipeline import run_pipeline
from services import storage as supa_storage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["upload"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

CONTENT_TYPES = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
}


def _next_case_number(db: Session) -> str:
    from sqlalchemy import func
    count = db.query(func.count(Case.id)).scalar() or 0
    return f"SAM-2026-{count + 1:05d}"


def _process_file(file_path: str, ext: str, doc: Document, doc_dir: str) -> list[str]:
    """Split PDF into page images or copy single image. Returns page_paths."""
    page_paths = []
    if ext == ".pdf":
        pdf_doc = fitz.open(file_path)
        doc.page_count = len(pdf_doc)
        for i, page in enumerate(pdf_doc):
            pix = page.get_pixmap(dpi=200)
            page_path = os.path.join(doc_dir, f"page_{i+1}.png")
            pix.save(page_path)
            page_paths.append(page_path)
        pdf_doc.close()
    else:
        img = Image.open(file_path)
        page_path = os.path.join(doc_dir, "page_1.png")
        img.save(page_path, "PNG")
        page_paths.append(page_path)
        doc.page_count = 1
    return page_paths


def _upload_to_supabase(doc: Document, file_path: str, ext: str, page_paths: list[str], bucket: str, storage_prefix: str):
    """Upload original file and page images to Supabase Storage."""
    if not supa_storage.is_enabled():
        return

    filename = os.path.basename(file_path)
    with open(file_path, "rb") as f:
        url = supa_storage.upload_file(
            f"{storage_prefix}/{filename}", f.read(),
            CONTENT_TYPES.get(ext, "application/octet-stream"),
            bucket=bucket,
        )
    if url:
        doc.original_path = url
        logger.info(f"Doc {doc.id}: Original uploaded to Supabase Storage ({bucket})")

    for pp in page_paths:
        fname = os.path.basename(pp)
        with open(pp, "rb") as f:
            supa_storage.upload_file(f"{storage_prefix}/{fname}", f.read(), "image/png", bucket=bucket)
    logger.info(f"Doc {doc.id}: {len(page_paths)} page images uploaded to Supabase Storage")


@router.post("/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    case_id: int | None = Form(None),
    doc_type: str = Form("general"),
    db: Session = Depends(get_db),
):
    # Validate file type
    allowed = {".pdf", ".png", ".jpg", ".jpeg"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed:
        raise HTTPException(400, f"File type {ext} not supported. Allowed: {', '.join(allowed)}")

    # Create document record
    doc = Document(
        filename=file.filename,
        status="queued",
        pipeline_step="upload",
        doc_type=doc_type,
        case_id=case_id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Create local doc folder
    doc_dir = os.path.join(UPLOAD_DIR, str(doc.id))
    os.makedirs(doc_dir, exist_ok=True)

    # Save original file locally
    file_path = os.path.join(doc_dir, file.filename)
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    doc.original_path = file_path

    # Process file into page images
    page_paths = _process_file(file_path, ext, doc, doc_dir)

    # Choose bucket based on doc_type
    bucket_map = {
        "pre_auth": supa_storage.BUCKET_PRE_AUTH,
        "discharge_summary": supa_storage.BUCKET_DISCHARGE,
        "icp": supa_storage.BUCKET_ICP,
    }
    bucket = bucket_map.get(doc_type, supa_storage.BUCKET_DOCUMENTS)
    storage_prefix = f"{doc.id}" if not case_id else f"{case_id}/{doc.id}"

    _upload_to_supabase(doc, file_path, ext, page_paths, bucket, storage_prefix)
    db.commit()

    # Trigger pipeline in background
    background_tasks.add_task(run_pipeline, doc.id, page_paths)

    return {
        "id": doc.id,
        "filename": doc.filename,
        "status": doc.status,
        "page_count": doc.page_count,
        "doc_type": doc.doc_type,
        "case_id": case_id,
        "message": "Document uploaded and queued for processing",
    }


@router.post("/upload/pre-auth")
async def upload_pre_auth(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    patient_name: str = Form(...),
    patient_age: str = Form(""),
    patient_gender: str = Form(""),
    patient_id_external: str = Form(""),
    tpa_name: str = Form(""),
    policy_number: str = Form(""),
    insurance_company: str = Form(""),
    primary_diagnosis: str = Form(""),
    primary_procedure: str = Form(""),
    requested_amount: float = Form(0),
    db: Session = Depends(get_db),
):
    """Upload a pre-auth document and auto-create a case."""
    allowed = {".pdf", ".png", ".jpg", ".jpeg"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed:
        raise HTTPException(400, f"File type {ext} not supported.")

    # Find or create patient
    patient = None
    if patient_id_external:
        patient = db.query(Patient).filter(Patient.patient_id_external == patient_id_external).first()
    if not patient:
        patient = Patient(
            name=patient_name,
            age=patient_age,
            gender=patient_gender,
            patient_id_external=patient_id_external,
        )
        db.add(patient)
        db.flush()

    # Create case
    case = Case(
        case_number=_next_case_number(db),
        patient_id=patient.id,
        current_stage="PreAuth",
        status="active",
        tpa_name=tpa_name,
        policy_number=policy_number,
        insurance_company=insurance_company,
        primary_diagnosis=primary_diagnosis,
        primary_procedure=primary_procedure,
    )
    db.add(case)
    db.flush()

    # Create pre-auth record
    from decimal import Decimal
    pre_auth = PreAuth(
        case_id=case.id,
        requested_amount=Decimal(str(requested_amount)) if requested_amount else 0,
    )
    db.add(pre_auth)

    # Log initial state
    transition = StateTransition(
        case_id=case.id,
        from_stage="Created",
        to_stage="PreAuth",
        action="pre_auth_upload",
        performed_by="billing_staff",
    )
    db.add(transition)

    # Create document linked to case
    doc = Document(
        filename=file.filename,
        status="queued",
        pipeline_step="upload",
        doc_type="pre_auth",
        case_id=case.id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Save and process file
    doc_dir = os.path.join(UPLOAD_DIR, str(doc.id))
    os.makedirs(doc_dir, exist_ok=True)
    file_path = os.path.join(doc_dir, file.filename)
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    doc.original_path = file_path

    page_paths = _process_file(file_path, ext, doc, doc_dir)
    storage_prefix = f"{case.hospital_org_id}/{case.id}/{doc.id}"
    _upload_to_supabase(doc, file_path, ext, page_paths, supa_storage.BUCKET_PRE_AUTH, storage_prefix)
    db.commit()

    # Trigger pipeline
    background_tasks.add_task(run_pipeline, doc.id, page_paths)

    return {
        "id": doc.id,
        "case_id": case.id,
        "case_number": case.case_number,
        "filename": doc.filename,
        "status": doc.status,
        "page_count": doc.page_count,
        "message": "Pre-auth document uploaded, case created, and queued for AI processing",
    }


from pydantic import BaseModel

class TextUploadRequest(BaseModel):
    text: str
    filename: str = "Pasted_Clinical_Note.txt"
    case_id: int | None = None
    doc_type: str = "general"

@router.post("/upload/text")
async def upload_text(
    req: TextUploadRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    if not req.text.strip():
        raise HTTPException(400, "Text cannot be empty")

    doc = Document(
        filename=req.filename,
        status="queued",
        pipeline_step="upload",
        page_count=1,
        doc_type=req.doc_type,
        case_id=req.case_id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    doc_dir = os.path.join(UPLOAD_DIR, str(doc.id))
    os.makedirs(doc_dir, exist_ok=True)

    file_path = os.path.join(doc_dir, req.filename)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(req.text)

    doc.original_path = file_path

    # Upload text file to Supabase Storage
    if supa_storage.is_enabled():
        url = supa_storage.upload_file(
            f"{doc.id}/{req.filename}", req.text.encode("utf-8"), "text/plain"
        )
        if url:
            doc.original_path = url

    db.commit()

    # Pass the .txt file path directly to the pipeline
    background_tasks.add_task(run_pipeline, doc.id, [file_path])

    return {
        "id": doc.id,
        "filename": doc.filename,
        "status": doc.status,
        "page_count": 1,
        "message": "Text queued for ultra-fast NLP processing",
    }
