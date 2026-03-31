from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


# --- Clinical Entity Schemas ---

class ClinicalEntitySchema(BaseModel):
    entity_text: str
    entity_type: Literal["DIAGNOSIS", "PROCEDURE", "MEDICATION", "LAB_TEST", "VITAL", "DEMOGRAPHIC"]
    normalized_value: str = ""
    negated: bool = False
    temporal_context: Optional[str] = None
    confidence: float = Field(ge=0.0, le=1.0, default=0.0)


class CodedEntitySchema(ClinicalEntitySchema):
    coded_value: Optional[str] = None
    code_system: Optional[str] = None
    code_description: Optional[str] = None
    similarity_score: float = 0.0
    needs_review: bool = False


# --- Vision Extraction Schemas ---

class MedicationItem(BaseModel):
    name: str
    dose: str = ""
    frequency: str = ""

class LabResult(BaseModel):
    name: str
    value: str
    unit: str = ""
    reference_range: str = ""

class BillingItem(BaseModel):
    description: str
    amount: float = 0.0
    code: Optional[str] = None

class VisionExtractionSchema(BaseModel):
    patient_name: str = ""
    patient_age: str = ""
    patient_id: str = ""
    patient_gender: str = ""
    diagnoses: list[str] = []
    procedures: list[str] = []
    medications: list[MedicationItem] = []
    lab_results: list[LabResult] = []
    vitals: dict = {}
    billing_items: list[BillingItem] = []
    raw_text: str = ""
    confidence_score: float = 0.0


# --- Reconciliation Schemas ---

class ReconciliationAlert(BaseModel):
    alert_type: Literal["MISSED_CHARGE", "PHANTOM_BILLING", "DUPLICATE_BILLING", "UNBUNDLING_RISK"]
    severity: Literal["high", "medium", "low"] = "medium"
    description: str
    entity_text: str = ""
    expected_code: str = ""
    estimated_impact: float = 0.0


# --- API Response Schemas ---

class DocumentResponse(BaseModel):
    id: int
    filename: str
    doc_type: str = "general"
    status: str
    pipeline_step: str
    confidence_score: float
    page_count: int
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EntityResponse(BaseModel):
    id: int
    document_id: int
    entity_text: str
    entity_type: str
    normalized_value: Optional[str]
    coded_value: Optional[str]
    code_system: Optional[str]
    code_description: Optional[str]
    confidence: float
    negated: bool
    needs_review: bool
    reviewer_approved: Optional[bool]

    class Config:
        from_attributes = True


class EntityUpdateRequest(BaseModel):
    reviewer_approved: Optional[bool] = None
    coded_value: Optional[str] = None
    code_system: Optional[str] = None
    entity_text: Optional[str] = None
    normalized_value: Optional[str] = None


class AlertResponse(BaseModel):
    id: int
    document_id: int
    patient_name: Optional[str]
    severity: str
    flagged_findings: Optional[str]
    acknowledged: bool
    acknowledged_by: Optional[str]
    acknowledged_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class MetricsResponse(BaseModel):
    total_documents: int = 0
    documents_processed: int = 0
    documents_in_queue: int = 0
    documents_needs_review: int = 0
    average_confidence: float = 0.0
    high_confidence_pct: float = 0.0  # > 0.85
    medium_confidence_pct: float = 0.0  # 0.5 - 0.85
    low_confidence_pct: float = 0.0  # < 0.5


class RevenueAnalyticsResponse(BaseModel):
    total_missed_revenue: float = 0.0
    total_phantom_billed: float = 0.0
    net_revenue_impact: float = 0.0
    total_alerts: int = 0
    documents_with_issues: int = 0
    per_document: list[dict] = []
