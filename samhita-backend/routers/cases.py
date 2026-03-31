"""Workflow State Machine — Case lifecycle API"""
import json
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from models.document import (
    get_db, Case, Patient, PreAuth, Bill, StateTransition,
    WORKFLOW_STAGES, VALID_TRANSITIONS,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/cases", tags=["cases"])

# ─── Counter helper ─────────────────────────────────────────────────────────

def _next_case_number(db: Session) -> str:
    from sqlalchemy import func
    count = db.query(func.count(Case.id)).scalar() or 0
    return f"SAM-2026-{count + 1:05d}"


# ─── Schemas ─────────────────────────────────────────────────────────────────

class CaseCreateRequest(BaseModel):
    patient_name: str
    patient_age: str = ""
    patient_gender: str = ""
    patient_id_external: str = ""
    abha_id: str = ""
    phone: str = ""
    tpa_name: str = ""
    policy_number: str = ""
    insurance_company: str = ""
    primary_diagnosis: str = ""
    primary_procedure: str = ""


class StageAdvanceRequest(BaseModel):
    to_stage: str
    action: str = ""
    performed_by: str = "billing_staff"
    notes: str = ""


class CaseUpdateRequest(BaseModel):
    tpa_name: Optional[str] = None
    policy_number: Optional[str] = None
    insurance_company: Optional[str] = None
    primary_diagnosis: Optional[str] = None
    primary_diagnosis_code: Optional[str] = None
    primary_procedure: Optional[str] = None
    primary_procedure_code: Optional[str] = None
    admission_date: Optional[str] = None
    discharge_date: Optional[str] = None
    status: Optional[str] = None


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("")
def create_case(req: CaseCreateRequest, db: Session = Depends(get_db)):
    """Create a new case with a patient record."""
    # Find or create patient
    patient = None
    if req.patient_id_external:
        patient = db.query(Patient).filter(Patient.patient_id_external == req.patient_id_external).first()
    if not patient and req.abha_id:
        patient = db.query(Patient).filter(Patient.abha_id == req.abha_id).first()

    if not patient:
        patient = Patient(
            name=req.patient_name,
            age=req.patient_age,
            gender=req.patient_gender,
            patient_id_external=req.patient_id_external,
            abha_id=req.abha_id,
            phone=req.phone,
        )
        db.add(patient)
        db.flush()

    case = Case(
        case_number=_next_case_number(db),
        patient_id=patient.id,
        current_stage="PreAuth",
        status="active",
        tpa_name=req.tpa_name,
        policy_number=req.policy_number,
        insurance_company=req.insurance_company,
        primary_diagnosis=req.primary_diagnosis,
        primary_procedure=req.primary_procedure,
    )
    db.add(case)
    db.flush()

    # Create initial pre-auth record
    pre_auth = PreAuth(case_id=case.id)
    db.add(pre_auth)

    # Log initial state
    transition = StateTransition(
        case_id=case.id,
        from_stage="Created",
        to_stage="PreAuth",
        action="case_created",
        performed_by="system",
    )
    db.add(transition)
    db.commit()

    return _case_to_dict(case, db)


@router.get("")
def list_cases(
    stage: str = Query(None),
    status: str = Query(None),
    search: str = Query(None),
    db: Session = Depends(get_db),
):
    """List all cases with optional filters."""
    query = db.query(Case).order_by(Case.created_at.desc())

    if stage:
        query = query.filter(Case.current_stage == stage)
    if status:
        query = query.filter(Case.status == status)
    if search:
        search_term = f"%{search}%"
        query = query.join(Patient).filter(
            (Patient.name.ilike(search_term)) |
            (Case.case_number.ilike(search_term)) |
            (Patient.patient_id_external.ilike(search_term))
        )

    cases = query.all()
    return {
        "cases": [_case_to_dict(c, db) for c in cases],
        "total": len(cases),
    }


@router.get("/stages")
def get_stages():
    """Return the workflow stages and valid transitions."""
    return {
        "stages": WORKFLOW_STAGES,
        "transitions": {k: list(v) for k, v in VALID_TRANSITIONS.items()},
    }


@router.get("/stats")
def get_case_stats(db: Session = Depends(get_db)):
    """Dashboard stats: cases by stage, totals."""
    from sqlalchemy import func

    total = db.query(func.count(Case.id)).filter(Case.status == "active").scalar() or 0

    stage_counts = {}
    for stage in WORKFLOW_STAGES:
        count = db.query(func.count(Case.id)).filter(
            Case.current_stage == stage, Case.status == "active"
        ).scalar() or 0
        stage_counts[stage] = count

    return {
        "total_active": total,
        "by_stage": stage_counts,
    }


@router.get("/{case_id}")
def get_case(case_id: int, db: Session = Depends(get_db)):
    """Get a single case with full details."""
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(404, "Case not found")
    return _case_to_dict(case, db, full=True)


@router.patch("/{case_id}")
def update_case(case_id: int, req: CaseUpdateRequest, db: Session = Depends(get_db)):
    """Update case fields."""
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(404, "Case not found")

    for field, value in req.model_dump(exclude_unset=True).items():
        if value is not None:
            if field in ("admission_date", "discharge_date") and isinstance(value, str):
                try:
                    value = datetime.fromisoformat(value)
                except ValueError:
                    pass
            setattr(case, field, value)

    case.updated_at = datetime.utcnow()
    db.commit()
    return _case_to_dict(case, db)


@router.post("/{case_id}/advance")
def advance_stage(case_id: int, req: StageAdvanceRequest, db: Session = Depends(get_db)):
    """Move a case to the next workflow stage."""
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(404, "Case not found")

    if case.status != "active":
        raise HTTPException(400, f"Case is {case.status}, cannot advance")

    current = case.current_stage
    target = req.to_stage

    if target not in WORKFLOW_STAGES and target != "Closure":
        raise HTTPException(400, f"Invalid stage: {target}")

    valid = VALID_TRANSITIONS.get(current, set())
    if target not in valid:
        raise HTTPException(400, f"Cannot transition from {current} to {target}. Valid: {list(valid)}")

    # Record transition
    transition = StateTransition(
        case_id=case.id,
        from_stage=current,
        to_stage=target,
        action=req.action or f"advanced_to_{target}",
        performed_by=req.performed_by,
        notes=req.notes,
    )
    db.add(transition)

    case.current_stage = target
    if target == "Closure":
        case.status = "closed"
    case.updated_at = datetime.utcnow()
    db.commit()

    return _case_to_dict(case, db)


@router.get("/{case_id}/history")
def get_case_history(case_id: int, db: Session = Depends(get_db)):
    """Get the full state transition history for a case."""
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(404, "Case not found")

    transitions = db.query(StateTransition).filter(
        StateTransition.case_id == case_id
    ).order_by(StateTransition.created_at).all()

    return {
        "case_id": case_id,
        "case_number": case.case_number,
        "current_stage": case.current_stage,
        "transitions": [
            {
                "id": t.id,
                "from_stage": t.from_stage,
                "to_stage": t.to_stage,
                "action": t.action,
                "performed_by": t.performed_by,
                "notes": t.notes,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in transitions
        ],
    }


@router.get("/{case_id}/probability")
def get_claim_probability(case_id: int, db: Session = Depends(get_db)):
    """Get AI-estimated claim approval probability."""
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(404, "Case not found")

    has_docs = len(case.documents) > 0

    case_data = {
        "tpa_name": case.tpa_name or "",
        "current_stage": case.current_stage,
        "primary_diagnosis": case.primary_diagnosis or "",
        "primary_procedure": case.primary_procedure or "",
        "has_referral_letter": has_docs,
        "has_doctor_notes": has_docs,
        "has_investigation_reports": any(d.doc_type in ("lab", "imaging") for d in case.documents),
        "has_pre_auth_form": any(d.doc_type == "pre_auth" for d in case.documents),
        "has_diagnosis_code": bool(case.primary_diagnosis_code),
        "has_procedure_code": bool(case.primary_procedure_code),
        "has_policy_number": bool(case.policy_number),
        "has_admission_date": bool(case.admission_date),
        "has_patient_id": bool(case.patient.patient_id_external if case.patient else False),
    }

    from services.claim_probability import calculate_claim_probability
    return calculate_claim_probability(case_data)


@router.get("/{case_id}/tat")
def get_case_tat(case_id: int, db: Session = Depends(get_db)):
    """Get turnaround time (TAT) tracking for a case."""
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(404, "Case not found")

    transitions = db.query(StateTransition).filter(
        StateTransition.case_id == case_id
    ).order_by(StateTransition.created_at).all()

    expected_tat = {
        "PreAuth": 24, "Submission": 4, "QueryHandling": 48,
        "Approval": 72, "Admission": 2, "BillGeneration": 24,
        "Enhancement": 48, "Discharge": 4, "Settlement": 168,
        "Reconciliation": 72, "Closure": 24,
    }

    stage_durations = []
    for i, t in enumerate(transitions):
        end_time = transitions[i + 1].created_at if i + 1 < len(transitions) else datetime.utcnow()
        duration_hours = (end_time - t.created_at).total_seconds() / 3600
        expected = expected_tat.get(t.to_stage, 24)
        stage_durations.append({
            "stage": t.to_stage,
            "entered_at": t.created_at.isoformat(),
            "duration_hours": round(duration_hours, 1),
            "expected_hours": expected,
            "overdue": duration_hours > expected,
            "overdue_by_hours": round(max(0, duration_hours - expected), 1),
        })

    total_hours = sum(s["duration_hours"] for s in stage_durations)
    overdue_stages = [s for s in stage_durations if s["overdue"]]

    return {
        "case_id": case_id,
        "current_stage": case.current_stage,
        "total_tat_hours": round(total_hours, 1),
        "total_tat_days": round(total_hours / 24, 1),
        "stages": stage_durations,
        "overdue_count": len(overdue_stages),
        "overdue_stages": [s["stage"] for s in overdue_stages],
    }


@router.get("/{case_id}/pdf/{pdf_type}")
def generate_case_pdf(case_id: int, pdf_type: str, db: Session = Depends(get_db)):
    """Generate a PDF for a case. Types: pre_auth, bill_summary, settlement."""
    from fastapi.responses import Response
    from services.pdf_generator import generate_pre_auth_pdf, generate_bill_summary_pdf, generate_settlement_pdf

    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(404, "Case not found")

    case_dict = _case_to_dict(case, db, full=True)

    if pdf_type == "pre_auth":
        pre_auth = case_dict.get("pre_auth", {})
        pdf_bytes = generate_pre_auth_pdf(case_dict, pre_auth or {})
        filename = f"PreAuth_{case.case_number}.pdf"
    elif pdf_type == "bill_summary":
        bills = case_dict.get("bills", [])
        for b in bills:
            bill_obj = db.query(Bill).filter(Bill.id == b["id"]).first()
            if bill_obj:
                b["items"] = [
                    {"description": i.description, "code": i.code, "category": i.category,
                     "quantity": i.quantity, "unit_price": float(i.unit_price or 0), "amount": float(i.amount or 0)}
                    for i in bill_obj.items
                ]
        pre_auth = case_dict.get("pre_auth", {})
        pdf_bytes = generate_bill_summary_pdf(case_dict, bills, pre_auth)
        filename = f"BillSummary_{case.case_number}.pdf"
    elif pdf_type == "settlement":
        from models.document import Settlement
        settlement = db.query(Settlement).filter(Settlement.case_id == case_id).first()
        if not settlement:
            raise HTTPException(404, "No settlement found")
        settlement_dict = {
            "billed_amount": float(settlement.billed_amount or 0),
            "approved_amount": float(settlement.approved_amount or 0),
            "settled_amount": float(settlement.settled_amount or 0),
            "total_deductions": float(settlement.total_deductions or 0),
            "patient_liability": float(settlement.patient_liability or 0),
            "deductions": [
                {"reason": d.reason, "category": d.category, "amount": float(d.amount or 0)}
                for d in settlement.deductions
            ],
        }
        pdf_bytes = generate_settlement_pdf(case_dict, settlement_dict)
        filename = f"Settlement_{case.case_number}.pdf"
    else:
        raise HTTPException(400, f"Unknown PDF type: {pdf_type}. Use: pre_auth, bill_summary, settlement")

    if not pdf_bytes:
        raise HTTPException(500, "PDF generation failed")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ─── Helper ──────────────────────────────────────────────────────────────────

def _case_to_dict(case: Case, db: Session, full: bool = False) -> dict:
    patient = case.patient
    result = {
        "id": case.id,
        "case_number": case.case_number,
        "current_stage": case.current_stage,
        "status": case.status,
        "patient": {
            "id": patient.id,
            "name": patient.name,
            "age": patient.age,
            "gender": patient.gender,
            "patient_id_external": patient.patient_id_external,
            "abha_id": patient.abha_id,
        },
        "tpa_name": case.tpa_name,
        "policy_number": case.policy_number,
        "insurance_company": case.insurance_company,
        "primary_diagnosis": case.primary_diagnosis,
        "primary_diagnosis_code": case.primary_diagnosis_code,
        "primary_procedure": case.primary_procedure,
        "primary_procedure_code": case.primary_procedure_code,
        "admission_date": case.admission_date.isoformat() if case.admission_date else None,
        "discharge_date": case.discharge_date.isoformat() if case.discharge_date else None,
        "created_at": case.created_at.isoformat() if case.created_at else None,
        "updated_at": case.updated_at.isoformat() if case.updated_at else None,
    }

    if full:
        # Include pre-auth
        pre_auth = case.pre_auth
        if pre_auth:
            result["pre_auth"] = {
                "id": pre_auth.id,
                "requested_amount": float(pre_auth.requested_amount or 0),
                "approved_amount": float(pre_auth.approved_amount or 0) if pre_auth.approved_amount else None,
                "approval_status": pre_auth.approval_status,
                "approval_reference": pre_auth.approval_reference,
                "submitted_at": pre_auth.submitted_at.isoformat() if pre_auth.submitted_at else None,
                "approved_at": pre_auth.approved_at.isoformat() if pre_auth.approved_at else None,
            }

        # Include bills summary
        result["bills"] = [
            {
                "id": b.id,
                "bill_number": b.bill_number,
                "bill_type": b.bill_type,
                "total_amount": float(b.total_amount or 0),
                "approved_amount": float(b.approved_amount or 0) if b.approved_amount else None,
                "status": b.status,
                "item_count": len(b.items),
            }
            for b in case.bills
        ]

        # Include documents
        result["documents"] = [
            {
                "id": d.id,
                "filename": d.filename,
                "doc_type": d.doc_type,
                "status": d.status,
                "confidence_score": d.confidence_score,
            }
            for d in case.documents
        ]

        # Include state history
        result["transitions"] = [
            {
                "from_stage": t.from_stage,
                "to_stage": t.to_stage,
                "action": t.action,
                "performed_by": t.performed_by,
                "notes": t.notes,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in case.state_transitions
        ]

    return result
