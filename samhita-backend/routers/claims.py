"""Claims Lifecycle API — Approval, Billing, Discharge, Settlement, Reconciliation"""
import json
import logging
from datetime import datetime
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from models.document import (
    get_db, Case, PreAuth, Bill, BillItem, Payment,
    Settlement, Deduction, StateTransition, Document,
    WORKFLOW_STAGES, VALID_TRANSITIONS,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/claims", tags=["claims"])


# ─── Pre-Auth Schemas ────────────────────────────────────────────────────────

class PreAuthUpdateRequest(BaseModel):
    requested_amount: Optional[float] = None
    approved_amount: Optional[float] = None
    approval_status: Optional[str] = None  # pending/approved/rejected/query
    approval_reference: Optional[str] = None
    validity_days: Optional[int] = None
    diagnosis_codes: Optional[str] = None  # JSON array
    procedure_codes: Optional[str] = None  # JSON array
    notes: Optional[str] = None


# ─── Approval / Admission Schemas ────────────────────────────────────────────

class ApprovalRequest(BaseModel):
    approved_amount: float
    approval_reference: str = ""
    validity_days: int = 30
    conditions: str = ""
    notes: str = ""


class AdmissionRequest(BaseModel):
    admission_date: str  # ISO date
    ip_number: str = ""
    notes: str = ""


# ─── Billing Schemas ─────────────────────────────────────────────────────────

class BillCreateRequest(BaseModel):
    bill_type: str = "interim"  # interim/final/enhancement
    items: list[dict] = []  # [{description, code, category, quantity, unit_price, amount}]
    notes: str = ""


class BillItemRequest(BaseModel):
    description: str
    code: str = ""
    category: str = ""  # surgery/consumable/room/lab/pharmacy
    quantity: int = 1
    unit_price: float = 0
    amount: float = 0


class EnhancementRequest(BaseModel):
    additional_amount: float
    reason: str
    notes: str = ""


# ─── Settlement Schemas ──────────────────────────────────────────────────────

class SettlementCreateRequest(BaseModel):
    billed_amount: float
    approved_amount: float = 0
    settled_amount: float = 0
    patient_liability: float = 0
    notes: str = ""
    deductions: list[dict] = []  # [{reason, category, amount, bill_item_ref}]


class PaymentRequest(BaseModel):
    payment_type: str  # tpa_settlement/patient_copay/insurance_direct
    amount: float
    reference_number: str = ""
    payment_date: Optional[str] = None
    notes: str = ""


# ─── Pre-Auth Endpoints ──────────────────────────────────────────────────────

@router.get("/{case_id}/pre-auth")
def get_pre_auth(case_id: int, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(404, "Case not found")
    pre_auth = db.query(PreAuth).filter(PreAuth.case_id == case_id).first()
    if not pre_auth:
        raise HTTPException(404, "No pre-auth found for this case")
    return _pre_auth_dict(pre_auth)


@router.patch("/{case_id}/pre-auth")
def update_pre_auth(case_id: int, req: PreAuthUpdateRequest, db: Session = Depends(get_db)):
    pre_auth = db.query(PreAuth).filter(PreAuth.case_id == case_id).first()
    if not pre_auth:
        raise HTTPException(404, "No pre-auth found for this case")

    for field, value in req.model_dump(exclude_unset=True).items():
        if value is not None:
            if field in ("requested_amount", "approved_amount"):
                value = Decimal(str(value))
            setattr(pre_auth, field, value)

    if req.approval_status == "approved" and not pre_auth.submitted_at:
        pre_auth.submitted_at = datetime.utcnow()
    pre_auth.updated_at = datetime.utcnow()
    db.commit()
    return _pre_auth_dict(pre_auth)


# ─── Approval + Admission (Phase 2A) ─────────────────────────────────────────

@router.post("/{case_id}/approve")
def approve_case(case_id: int, req: ApprovalRequest, db: Session = Depends(get_db)):
    """TPA approves the pre-auth. Moves case to Approval stage."""
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(404, "Case not found")

    pre_auth = db.query(PreAuth).filter(PreAuth.case_id == case_id).first()
    if pre_auth:
        pre_auth.approved_amount = Decimal(str(req.approved_amount))
        pre_auth.approval_status = "approved"
        pre_auth.approval_reference = req.approval_reference
        pre_auth.validity_days = req.validity_days
        pre_auth.approved_at = datetime.utcnow()
        if req.conditions:
            pre_auth.notes = (pre_auth.notes or "") + f"\nConditions: {req.conditions}"

    # Advance to Approval stage if still in early stages
    if case.current_stage in ("PreAuth", "Submission", "QueryHandling"):
        _advance(case, "Approval", "tpa_approval", "system", req.notes, db)

    db.commit()
    return {"message": "Case approved", "case_id": case_id, "approved_amount": req.approved_amount}


@router.post("/{case_id}/admit")
def admit_patient(case_id: int, req: AdmissionRequest, db: Session = Depends(get_db)):
    """Record patient admission. Moves to Admission stage and creates initial bill."""
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(404, "Case not found")

    try:
        case.admission_date = datetime.fromisoformat(req.admission_date)
    except ValueError:
        raise HTTPException(400, "Invalid admission_date format")

    # Generate IP number if not provided
    ip_number = req.ip_number or f"IP-{case.id:06d}"

    if case.current_stage in ("PreAuth", "Submission", "QueryHandling", "Approval"):
        _advance(case, "Admission", "patient_admitted", "billing_staff", req.notes, db)

    # Create initial bill
    bill = Bill(
        case_id=case.id,
        bill_number=f"BILL-{case.case_number}-001",
        bill_type="interim",
        total_amount=0,
        status="draft",
    )
    db.add(bill)
    db.commit()

    return {
        "message": "Patient admitted",
        "case_id": case_id,
        "ip_number": ip_number,
        "bill_id": bill.id,
        "admission_date": case.admission_date.isoformat(),
    }


# ─── Billing (Phase 2B) ──────────────────────────────────────────────────────

@router.get("/{case_id}/bills")
def list_bills(case_id: int, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(404, "Case not found")
    bills = db.query(Bill).filter(Bill.case_id == case_id).order_by(Bill.created_at).all()

    # Calculate totals
    pre_auth = db.query(PreAuth).filter(PreAuth.case_id == case_id).first()
    approved = float(pre_auth.approved_amount or 0) if pre_auth else 0
    total_billed = sum(float(b.total_amount or 0) for b in bills)

    return {
        "case_id": case_id,
        "approved_amount": approved,
        "total_billed": total_billed,
        "utilization_pct": round(total_billed / approved * 100, 1) if approved else 0,
        "bills": [_bill_dict(b) for b in bills],
    }


@router.post("/{case_id}/bills")
def create_bill(case_id: int, req: BillCreateRequest, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(404, "Case not found")

    bill_count = db.query(Bill).filter(Bill.case_id == case_id).count()
    bill = Bill(
        case_id=case_id,
        bill_number=f"BILL-{case.case_number}-{bill_count + 1:03d}",
        bill_type=req.bill_type,
        total_amount=0,
        status="draft",
    )
    db.add(bill)
    db.flush()

    total = Decimal("0")
    for item_data in req.items:
        amount = Decimal(str(item_data.get("amount", 0)))
        item = BillItem(
            bill_id=bill.id,
            description=item_data.get("description", ""),
            code=item_data.get("code", ""),
            category=item_data.get("category", ""),
            quantity=item_data.get("quantity", 1),
            unit_price=Decimal(str(item_data.get("unit_price", 0))),
            amount=amount,
        )
        db.add(item)
        total += amount

    bill.total_amount = total

    # Check threshold alerts
    pre_auth = db.query(PreAuth).filter(PreAuth.case_id == case_id).first()
    threshold_alert = None
    if pre_auth and pre_auth.approved_amount:
        approved = float(pre_auth.approved_amount)
        all_bills = db.query(Bill).filter(Bill.case_id == case_id).all()
        cumulative = sum(float(b.total_amount or 0) for b in all_bills) + float(total)
        pct = cumulative / approved * 100 if approved else 0

        if pct >= 100:
            threshold_alert = {"level": "critical", "message": f"Bill total ({pct:.0f}%) EXCEEDS approved amount!", "percentage": pct}
        elif pct >= 90:
            threshold_alert = {"level": "high", "message": f"Bill at {pct:.0f}% of approved amount", "percentage": pct}
        elif pct >= 80:
            threshold_alert = {"level": "warning", "message": f"Bill at {pct:.0f}% of approved amount", "percentage": pct}

    # Move to BillGeneration if appropriate
    if case.current_stage == "Admission":
        _advance(case, "BillGeneration", "bill_created", "billing_staff", "", db)

    db.commit()
    result = _bill_dict(bill)
    if threshold_alert:
        result["threshold_alert"] = threshold_alert
    return result


@router.post("/{case_id}/bills/{bill_id}/items")
def add_bill_item(case_id: int, bill_id: int, req: BillItemRequest, db: Session = Depends(get_db)):
    bill = db.query(Bill).filter(Bill.id == bill_id, Bill.case_id == case_id).first()
    if not bill:
        raise HTTPException(404, "Bill not found")

    amount = Decimal(str(req.amount)) if req.amount else Decimal(str(req.unit_price)) * req.quantity
    item = BillItem(
        bill_id=bill.id,
        description=req.description,
        code=req.code,
        category=req.category,
        quantity=req.quantity,
        unit_price=Decimal(str(req.unit_price)),
        amount=amount,
    )
    db.add(item)

    # Recalculate bill total
    bill.total_amount = sum(Decimal(str(i.amount or 0)) for i in bill.items) + amount
    bill.updated_at = datetime.utcnow()
    db.commit()

    return _bill_dict(bill)


@router.post("/{case_id}/enhance")
def request_enhancement(case_id: int, req: EnhancementRequest, db: Session = Depends(get_db)):
    """Request additional approved amount (enhancement/top-up)."""
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(404, "Case not found")

    pre_auth = db.query(PreAuth).filter(PreAuth.case_id == case_id).first()
    if not pre_auth:
        raise HTTPException(400, "No pre-auth exists for this case")

    old_amount = float(pre_auth.approved_amount or 0)
    pre_auth.approved_amount = Decimal(str(old_amount + req.additional_amount))
    pre_auth.notes = (pre_auth.notes or "") + f"\nEnhancement: +{req.additional_amount} — {req.reason}"

    if case.current_stage == "BillGeneration":
        _advance(case, "Enhancement", "enhancement_requested", "billing_staff", req.notes, db)

    db.commit()
    return {
        "message": "Enhancement approved",
        "previous_amount": old_amount,
        "additional_amount": req.additional_amount,
        "new_approved_amount": float(pre_auth.approved_amount),
    }


# ─── Discharge + Settlement + Reconciliation (Phase 2C) ──────────────────────

class DischargeRequest(BaseModel):
    discharge_date: str
    discharge_summary_doc_id: Optional[int] = None
    notes: str = ""


@router.post("/{case_id}/discharge")
def discharge_patient(case_id: int, req: DischargeRequest, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(404, "Case not found")

    try:
        case.discharge_date = datetime.fromisoformat(req.discharge_date)
    except ValueError:
        raise HTTPException(400, "Invalid discharge_date format")

    # Link discharge summary document if provided
    if req.discharge_summary_doc_id:
        doc = db.query(Document).filter(Document.id == req.discharge_summary_doc_id).first()
        if doc:
            doc.case_id = case_id
            doc.doc_type = "discharge_summary"

    if case.current_stage in ("BillGeneration", "Enhancement", "Admission"):
        _advance(case, "Discharge", "patient_discharged", "billing_staff", req.notes, db)

    db.commit()
    return {"message": "Patient discharged", "discharge_date": case.discharge_date.isoformat()}


@router.post("/{case_id}/settlement")
def create_settlement(case_id: int, req: SettlementCreateRequest, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(404, "Case not found")

    settlement = Settlement(
        case_id=case_id,
        billed_amount=Decimal(str(req.billed_amount)),
        approved_amount=Decimal(str(req.approved_amount)),
        settled_amount=Decimal(str(req.settled_amount)),
        patient_liability=Decimal(str(req.patient_liability)),
        total_deductions=Decimal("0"),
        status="pending",
        notes=req.notes,
    )
    db.add(settlement)
    db.flush()

    total_deductions = Decimal("0")
    for ded_data in req.deductions:
        ded_amount = Decimal(str(ded_data.get("amount", 0)))
        ded = Deduction(
            settlement_id=settlement.id,
            reason=ded_data.get("reason", ""),
            category=ded_data.get("category", ""),
            amount=ded_amount,
            bill_item_ref=ded_data.get("bill_item_ref", ""),
        )
        db.add(ded)
        total_deductions += ded_amount

    settlement.total_deductions = total_deductions

    if case.current_stage in ("Discharge",):
        _advance(case, "Settlement", "settlement_created", "billing_staff", req.notes, db)

    db.commit()
    return _settlement_dict(settlement)


@router.get("/{case_id}/settlement")
def get_settlement(case_id: int, db: Session = Depends(get_db)):
    settlements = db.query(Settlement).filter(Settlement.case_id == case_id).all()
    if not settlements:
        return {"case_id": case_id, "settlements": []}
    return {"case_id": case_id, "settlements": [_settlement_dict(s) for s in settlements]}


@router.post("/{case_id}/payment")
def record_payment(case_id: int, req: PaymentRequest, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(404, "Case not found")

    payment = Payment(
        case_id=case_id,
        payment_type=req.payment_type,
        amount=Decimal(str(req.amount)),
        reference_number=req.reference_number,
        notes=req.notes,
    )
    if req.payment_date:
        try:
            payment.payment_date = datetime.fromisoformat(req.payment_date)
        except ValueError:
            payment.payment_date = datetime.utcnow()
    else:
        payment.payment_date = datetime.utcnow()

    db.add(payment)
    db.commit()
    return {
        "id": payment.id,
        "payment_type": payment.payment_type,
        "amount": float(payment.amount),
        "reference_number": payment.reference_number,
    }


@router.get("/{case_id}/payments")
def list_payments(case_id: int, db: Session = Depends(get_db)):
    payments = db.query(Payment).filter(Payment.case_id == case_id).all()
    return {
        "case_id": case_id,
        "total_received": sum(float(p.amount or 0) for p in payments),
        "payments": [
            {
                "id": p.id,
                "payment_type": p.payment_type,
                "amount": float(p.amount or 0),
                "reference_number": p.reference_number,
                "payment_date": p.payment_date.isoformat() if p.payment_date else None,
                "notes": p.notes,
            }
            for p in payments
        ],
    }


@router.post("/{case_id}/reconcile")
def reconcile_case(case_id: int, db: Session = Depends(get_db)):
    """Run case-level reconciliation: bill vs approved vs settled."""
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(404, "Case not found")

    pre_auth = db.query(PreAuth).filter(PreAuth.case_id == case_id).first()
    bills = db.query(Bill).filter(Bill.case_id == case_id).all()
    settlements = db.query(Settlement).filter(Settlement.case_id == case_id).all()
    payments = db.query(Payment).filter(Payment.case_id == case_id).all()

    total_billed = sum(float(b.total_amount or 0) for b in bills)
    approved = float(pre_auth.approved_amount or 0) if pre_auth else 0
    total_settled = sum(float(s.settled_amount or 0) for s in settlements)
    total_deductions = sum(float(s.total_deductions or 0) for s in settlements)
    total_payments = sum(float(p.amount or 0) for p in payments)

    # Gaps analysis
    gaps = []
    if total_billed > approved and approved > 0:
        gaps.append({
            "type": "OVER_BILLED",
            "severity": "high",
            "description": f"Billed amount ({total_billed:,.0f}) exceeds approved ({approved:,.0f}) by {total_billed - approved:,.0f}",
            "amount": total_billed - approved,
        })

    if total_deductions > 0:
        deduction_pct = total_deductions / total_billed * 100 if total_billed else 0
        if deduction_pct > 20:
            gaps.append({
                "type": "HIGH_DEDUCTIONS",
                "severity": "high",
                "description": f"Deductions are {deduction_pct:.0f}% of billed amount — review for disallowances",
                "amount": total_deductions,
            })

    outstanding = total_billed - total_payments
    if outstanding > 0 and total_billed > 0:
        gaps.append({
            "type": "OUTSTANDING_BALANCE",
            "severity": "medium",
            "description": f"Outstanding balance: {outstanding:,.0f} (received {total_payments:,.0f} of {total_billed:,.0f})",
            "amount": outstanding,
        })

    # Move to reconciliation stage if appropriate
    if case.current_stage == "Settlement":
        _advance(case, "Reconciliation", "reconciliation_run", "system", "", db)
        db.commit()

    return {
        "case_id": case_id,
        "summary": {
            "approved_amount": approved,
            "total_billed": total_billed,
            "total_settled": total_settled,
            "total_deductions": total_deductions,
            "total_payments": total_payments,
            "outstanding_balance": total_billed - total_payments,
            "revenue_leakage": total_billed - total_settled if total_settled else 0,
        },
        "gaps": gaps,
        "deduction_breakdown": _deduction_breakdown(settlements),
    }


@router.post("/{case_id}/close")
def close_case(case_id: int, notes: str = "", db: Session = Depends(get_db)):
    """Close a case — final stage of the workflow."""
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(404, "Case not found")

    _advance(case, "Closure", "case_closed", "billing_staff", notes, db)
    case.status = "closed"
    db.commit()
    return {"message": "Case closed", "case_id": case_id}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _advance(case: Case, to_stage: str, action: str, by: str, notes: str, db: Session):
    """Record state transition and advance case stage."""
    transition = StateTransition(
        case_id=case.id,
        from_stage=case.current_stage,
        to_stage=to_stage,
        action=action,
        performed_by=by,
        notes=notes,
    )
    db.add(transition)
    case.current_stage = to_stage
    case.updated_at = datetime.utcnow()


def _pre_auth_dict(pa: PreAuth) -> dict:
    return {
        "id": pa.id,
        "case_id": pa.case_id,
        "requested_amount": float(pa.requested_amount or 0),
        "approved_amount": float(pa.approved_amount or 0) if pa.approved_amount else None,
        "approval_status": pa.approval_status,
        "approval_reference": pa.approval_reference,
        "validity_days": pa.validity_days,
        "diagnosis_codes": pa.diagnosis_codes,
        "procedure_codes": pa.procedure_codes,
        "notes": pa.notes,
        "submitted_at": pa.submitted_at.isoformat() if pa.submitted_at else None,
        "approved_at": pa.approved_at.isoformat() if pa.approved_at else None,
    }


def _bill_dict(b: Bill) -> dict:
    return {
        "id": b.id,
        "case_id": b.case_id,
        "bill_number": b.bill_number,
        "bill_type": b.bill_type,
        "total_amount": float(b.total_amount or 0),
        "approved_amount": float(b.approved_amount or 0) if b.approved_amount else None,
        "status": b.status,
        "items": [
            {
                "id": item.id,
                "description": item.description,
                "code": item.code,
                "category": item.category,
                "quantity": item.quantity,
                "unit_price": float(item.unit_price or 0),
                "amount": float(item.amount or 0),
            }
            for item in b.items
        ],
        "created_at": b.created_at.isoformat() if b.created_at else None,
    }


def _settlement_dict(s: Settlement) -> dict:
    return {
        "id": s.id,
        "case_id": s.case_id,
        "billed_amount": float(s.billed_amount or 0),
        "approved_amount": float(s.approved_amount or 0),
        "settled_amount": float(s.settled_amount or 0),
        "total_deductions": float(s.total_deductions or 0),
        "patient_liability": float(s.patient_liability or 0),
        "status": s.status,
        "notes": s.notes,
        "deductions": [
            {
                "id": d.id,
                "reason": d.reason,
                "category": d.category,
                "amount": float(d.amount or 0),
                "bill_item_ref": d.bill_item_ref,
            }
            for d in s.deductions
        ],
        "settled_at": s.settled_at.isoformat() if s.settled_at else None,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


def _deduction_breakdown(settlements: list[Settlement]) -> list[dict]:
    """Categorize deductions across all settlements."""
    categories = {}
    for s in settlements:
        for d in s.deductions:
            cat = d.category or "other"
            if cat not in categories:
                categories[cat] = {"category": cat, "count": 0, "total": 0, "reasons": []}
            categories[cat]["count"] += 1
            categories[cat]["total"] += float(d.amount or 0)
            categories[cat]["reasons"].append(d.reason)
    return list(categories.values())
