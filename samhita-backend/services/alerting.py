"""Patient Severity Triage & Alert Service"""
import logging
from models.document import SessionLocal, PatientAlert
import json

logger = logging.getLogger(__name__)

# Conditions that indicate critical/serious severity
CRITICAL_CONDITIONS = [
    "myocardial infarction", "heart attack", "cardiac arrest", "stroke",
    "pulmonary embolism", "sepsis", "septic shock", "respiratory failure",
    "renal failure", "acute kidney", "hemorrhage", "anaphylaxis",
    "meningitis", "encephalitis", "status epilepticus", "pneumothorax",
    "aortic dissection", "ruptured", "multiple organ",
]

SERIOUS_CONDITIONS = [
    "fracture", "pneumonia", "diabetic ketoacidosis", "dka",
    "acute pancreatitis", "gastrointestinal bleeding", "deep vein thrombosis",
    "dvt", "cellulitis", "abscess", "acute appendicitis",
    "bowel obstruction", "hypertensive crisis", "angina",
]

# Critical vital thresholds
CRITICAL_VITALS = {
    "blood_pressure_systolic_high": 180,
    "blood_pressure_systolic_low": 80,
    "pulse_high": 130,
    "pulse_low": 40,
    "spo2_low": 90,
    "temperature_high": 40.0,
    "rbs_high": 400,
}


def classify_severity(coded_entities: list[dict], extraction_data: dict = None) -> str:
    """Classify patient severity based on diagnoses and vitals."""
    # Check diagnoses
    diagnoses = [
        e.get("normalized_value", "").lower()
        for e in coded_entities
        if e.get("entity_type") == "DIAGNOSIS" and not e.get("negated")
    ]

    for diagnosis in diagnoses:
        for crit in CRITICAL_CONDITIONS:
            if crit in diagnosis:
                return "critical"

    for diagnosis in diagnoses:
        for serious in SERIOUS_CONDITIONS:
            if serious in diagnosis:
                return "serious"

    # Check vitals from extraction data
    if extraction_data and extraction_data.get("vitals"):
        vitals = extraction_data["vitals"]
        bp = vitals.get("blood_pressure", "")
        if "/" in bp:
            try:
                systolic = int(bp.split("/")[0].strip())
                if systolic >= CRITICAL_VITALS["blood_pressure_systolic_high"] or systolic <= CRITICAL_VITALS["blood_pressure_systolic_low"]:
                    return "critical"
            except ValueError:
                pass

        spo2 = vitals.get("spo2", "").replace("%", "").strip()
        if spo2:
            try:
                if float(spo2) < CRITICAL_VITALS["spo2_low"]:
                    return "critical"
            except ValueError:
                pass

    # Check lab values
    labs = [e for e in coded_entities if e.get("entity_type") == "LAB_TEST"]
    for lab in labs:
        norm = lab.get("normalized_value", "").lower()
        if "blood sugar" in norm or "rbs" in norm or "glucose" in norm:
            try:
                val = float("".join(c for c in norm.split(":")[-1] if c.isdigit() or c == "."))
                if val >= CRITICAL_VITALS["rbs_high"]:
                    return "serious"
            except (ValueError, IndexError):
                pass

    if len(diagnoses) >= 3:
        return "moderate"

    return "stable"


def create_alert_if_needed(doc_id: int, coded_entities: list[dict], extraction_data: dict = None) -> dict | None:
    """Create a patient alert if severity is critical or serious."""
    severity = classify_severity(coded_entities, extraction_data)

    if severity not in ("critical", "serious"):
        return None

    patient_name = ""
    if extraction_data:
        patient_name = extraction_data.get("patient_name", "Unknown Patient")

    # Collect flagged findings
    flagged = []
    for e in coded_entities:
        if e.get("entity_type") == "DIAGNOSIS" and not e.get("negated"):
            flagged.append(f"{e.get('normalized_value', e.get('entity_text', ''))}")
    for e in coded_entities:
        if e.get("entity_type") == "VITAL":
            flagged.append(f"{e.get('normalized_value', e.get('entity_text', ''))}")

    db = SessionLocal()
    try:
        alert = PatientAlert(
            document_id=doc_id,
            patient_name=patient_name,
            severity=severity,
            flagged_findings=json.dumps(flagged[:10]),  # Top 10 findings
        )
        db.add(alert)
        db.commit()
        db.refresh(alert)

        logger.warning(f"ALERT: {severity.upper()} patient — {patient_name} (doc {doc_id})")

        return {
            "alert_id": alert.id,
            "severity": severity,
            "patient_name": patient_name,
            "findings": flagged[:10],
        }
    finally:
        db.close()
