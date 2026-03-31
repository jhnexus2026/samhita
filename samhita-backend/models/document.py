from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, Text, DateTime, ForeignKey, Numeric, Index
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from datetime import datetime
import os
import socket
from urllib.parse import urlparse

DATABASE_URL = os.getenv("DATABASE_URL", "")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set. Point it to your Supabase PostgreSQL connection string.")

# Resolve hostname — try IPv4, then IPv6, then DNS-over-HTTPS fallback
_connect_args = {}
try:
    parsed = urlparse(DATABASE_URL)
    if parsed.hostname:
        resolved = None
        # Try local DNS (IPv4 then IPv6)
        for family in (socket.AF_INET, socket.AF_INET6):
            try:
                resolved = socket.getaddrinfo(parsed.hostname, parsed.port or 5432, family)[0][4][0]
                break
            except socket.gaierror:
                continue
        # Fallback: DNS-over-HTTPS via Google
        if not resolved:
            try:
                import requests
                for qtype in ("A", "AAAA"):
                    resp = requests.get(
                        f"https://dns.google/resolve?name={parsed.hostname}&type={qtype}",
                        timeout=5,
                    )
                    answers = resp.json().get("Answer", [])
                    if answers:
                        resolved = answers[0]["data"]
                        break
            except Exception:
                pass
        if resolved:
            _connect_args["hostaddr"] = resolved
except Exception:
    pass

engine = create_engine(
    DATABASE_URL,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    echo=False,
    connect_args=_connect_args,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ─── WORKFLOW STAGES ────────────────────────────────────────────────────────
WORKFLOW_STAGES = [
    "PreAuth",
    "Submission",
    "QueryHandling",
    "Approval",
    "Admission",
    "BillGeneration",
    "Enhancement",
    "Discharge",
    "Settlement",
    "Reconciliation",
    "Closure",
]

# Valid transitions: each stage can move to the next, or skip to QueryHandling/Closure
VALID_TRANSITIONS = {}
for i, stage in enumerate(WORKFLOW_STAGES):
    nexts = set()
    if i + 1 < len(WORKFLOW_STAGES):
        nexts.add(WORKFLOW_STAGES[i + 1])
    nexts.add("Closure")  # any stage can close
    if stage in ("Submission", "Approval"):
        nexts.add("QueryHandling")
    VALID_TRANSITIONS[stage] = nexts


# ─── EXISTING TABLES (kept) ────────────────────────────────────────────────

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=True)  # link to case
    filename = Column(String(255), nullable=False)
    doc_type = Column(String(50), default="general")  # pre_auth/discharge_summary/icp/bill/general
    original_path = Column(String(500))
    status = Column(String(50), default="queued")
    pipeline_step = Column(String(50), default="upload")
    extracted_json = Column(Text)
    coded_json = Column(Text)
    fhir_json = Column(Text)
    ayushman_json = Column(Text)
    reconciliation_alerts = Column(Text)
    confidence_score = Column(Float, default=0.0)
    page_count = Column(Integer, default=1)
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    case = relationship("Case", back_populates="documents", foreign_keys=[case_id])
    entities = relationship("ClinicalEntity", back_populates="document", cascade="all, delete-orphan")
    alerts = relationship("PatientAlert", back_populates="document", cascade="all, delete-orphan")


class ClinicalEntity(Base):
    __tablename__ = "clinical_entities"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    entity_text = Column(String(500), nullable=False)
    entity_type = Column(String(50), nullable=False)
    normalized_value = Column(String(500))
    coded_value = Column(String(50))
    code_system = Column(String(50))
    code_description = Column(String(500))
    confidence = Column(Float, default=0.0)
    negated = Column(Boolean, default=False)
    temporal_context = Column(String(200))
    needs_review = Column(Boolean, default=False)
    reviewer_approved = Column(Boolean, nullable=True)
    reviewed_by = Column(String(100))
    reviewed_at = Column(DateTime)

    document = relationship("Document", back_populates="entities")


class PatientAlert(Base):
    __tablename__ = "patient_alerts"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=True)
    patient_name = Column(String(200))
    severity = Column(String(20), nullable=False)
    flagged_findings = Column(Text)
    acknowledged = Column(Boolean, default=False)
    acknowledged_by = Column(String(100))
    acknowledged_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("Document", back_populates="alerts")
    case = relationship("Case", back_populates="alerts")


# ─── NEW: PATIENT ───────────────────────────────────────────────────────────

class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    age = Column(String(20))
    gender = Column(String(20))
    patient_id_external = Column(String(100))  # hospital MRN / UHID
    abha_id = Column(String(50))  # Ayushman Bharat Health Account
    phone = Column(String(20))
    address = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    cases = relationship("Case", back_populates="patient")

    __table_args__ = (
        Index("ix_patients_external_id", "patient_id_external"),
        Index("ix_patients_abha", "abha_id"),
    )


# ─── NEW: CASE (central entity) ────────────────────────────────────────────

class Case(Base):
    __tablename__ = "cases"

    id = Column(Integer, primary_key=True, index=True)
    case_number = Column(String(50), unique=True, nullable=False)  # e.g. SAM-2026-00042
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    hospital_org_id = Column(String(50), default="SAMHITA_DEMO")

    # Workflow
    current_stage = Column(String(30), default="PreAuth")
    status = Column(String(30), default="active")  # active/on_hold/closed/cancelled

    # TPA / Insurance
    tpa_name = Column(String(200))
    policy_number = Column(String(100))
    insurance_company = Column(String(200))

    # Clinical summary (denormalized for dashboard speed)
    primary_diagnosis = Column(String(500))
    primary_diagnosis_code = Column(String(20))
    primary_procedure = Column(String(500))
    primary_procedure_code = Column(String(20))

    # Dates
    admission_date = Column(DateTime, nullable=True)
    discharge_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    patient = relationship("Patient", back_populates="cases")
    documents = relationship("Document", back_populates="case", foreign_keys=[Document.case_id])
    pre_auth = relationship("PreAuth", back_populates="case", uselist=False)
    bills = relationship("Bill", back_populates="case")
    payments = relationship("Payment", back_populates="case")
    settlements = relationship("Settlement", back_populates="case")
    state_transitions = relationship("StateTransition", back_populates="case", order_by="StateTransition.created_at")
    alerts = relationship("PatientAlert", back_populates="case", foreign_keys=[PatientAlert.case_id])

    __table_args__ = (
        Index("ix_cases_stage", "current_stage"),
        Index("ix_cases_status", "status"),
        Index("ix_cases_patient", "patient_id"),
        Index("ix_cases_tpa", "tpa_name"),
        Index("ix_cases_created", "created_at"),
    )


# ─── NEW: PRE-AUTH ──────────────────────────────────────────────────────────

class PreAuth(Base):
    __tablename__ = "pre_auths"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False, unique=True)

    requested_amount = Column(Numeric(12, 2), default=0)
    approved_amount = Column(Numeric(12, 2), nullable=True)
    approval_status = Column(String(30), default="pending")  # pending/approved/rejected/query
    approval_reference = Column(String(100))  # TPA reference number
    validity_days = Column(Integer, default=30)

    diagnosis_codes = Column(Text)  # JSON array of ICD codes
    procedure_codes = Column(Text)  # JSON array of CPT codes
    notes = Column(Text)

    submitted_at = Column(DateTime, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    case = relationship("Case", back_populates="pre_auth")


# ─── NEW: BILL ──────────────────────────────────────────────────────────────

class Bill(Base):
    __tablename__ = "bills"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False)

    bill_number = Column(String(50))
    bill_type = Column(String(30), default="interim")  # interim/final/enhancement
    total_amount = Column(Numeric(12, 2), default=0)
    approved_amount = Column(Numeric(12, 2), nullable=True)

    status = Column(String(30), default="draft")  # draft/submitted/approved/rejected/settled
    threshold_alert_sent = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    case = relationship("Case", back_populates="bills")
    items = relationship("BillItem", back_populates="bill", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_bills_case", "case_id"),
        Index("ix_bills_status", "status"),
    )


class BillItem(Base):
    __tablename__ = "bill_items"

    id = Column(Integer, primary_key=True, index=True)
    bill_id = Column(Integer, ForeignKey("bills.id"), nullable=False)

    description = Column(String(500), nullable=False)
    code = Column(String(50))  # CPT / internal code
    category = Column(String(100))  # surgery/consumable/room/lab/pharmacy
    quantity = Column(Integer, default=1)
    unit_price = Column(Numeric(12, 2), default=0)
    amount = Column(Numeric(12, 2), default=0)

    bill = relationship("Bill", back_populates="items")


# ─── NEW: PAYMENT ───────────────────────────────────────────────────────────

class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False)

    payment_type = Column(String(30))  # tpa_settlement/patient_copay/insurance_direct
    amount = Column(Numeric(12, 2), default=0)
    reference_number = Column(String(100))  # UTR / cheque number
    payment_date = Column(DateTime, nullable=True)
    notes = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)

    case = relationship("Case", back_populates="payments")


# ─── NEW: DEDUCTION ─────────────────────────────────────────────────────────

class Deduction(Base):
    __tablename__ = "deductions"

    id = Column(Integer, primary_key=True, index=True)
    settlement_id = Column(Integer, ForeignKey("settlements.id"), nullable=False)

    reason = Column(String(500), nullable=False)  # e.g. "Non-payable item", "Excess room rent"
    category = Column(String(50))  # disallowance/excess/policy_exclusion/copay/proportional
    amount = Column(Numeric(12, 2), default=0)
    bill_item_ref = Column(String(200))  # which line item was deducted

    settlement = relationship("Settlement", back_populates="deductions")


# ─── NEW: SETTLEMENT ───────────────────────────────────────────────────────

class Settlement(Base):
    __tablename__ = "settlements"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False)

    billed_amount = Column(Numeric(12, 2), default=0)
    approved_amount = Column(Numeric(12, 2), default=0)
    settled_amount = Column(Numeric(12, 2), default=0)
    total_deductions = Column(Numeric(12, 2), default=0)
    patient_liability = Column(Numeric(12, 2), default=0)

    status = Column(String(30), default="pending")  # pending/partial/settled/disputed
    settled_at = Column(DateTime, nullable=True)
    notes = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    case = relationship("Case", back_populates="settlements")
    deductions = relationship("Deduction", back_populates="settlement", cascade="all, delete-orphan")


# ─── NEW: STATE TRANSITION (audit log) ─────────────────────────────────────

class StateTransition(Base):
    __tablename__ = "state_transitions"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False)

    from_stage = Column(String(30), nullable=False)
    to_stage = Column(String(30), nullable=False)
    action = Column(String(100))  # what triggered the transition
    performed_by = Column(String(100), default="system")
    notes = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)

    case = relationship("Case", back_populates="state_transitions")

    __table_args__ = (
        Index("ix_transitions_case", "case_id"),
    )


# ─── NEW: EXPLANATION CACHE ─────────────────────────────────────────────────

class ExplanationCache(Base):
    __tablename__ = "explanation_cache"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), nullable=False)  # ICD-10 / CPT / LOINC code
    code_system = Column(String(20), nullable=False)
    plain_explanation = Column(Text, nullable=False)  # billing-staff-friendly
    billing_notes = Column(Text)  # e.g. "package procedure, check approved rate"
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_explanation_code", "code", "code_system", unique=True),
    )


def init_db():
    Base.metadata.create_all(bind=engine)
