"""Claim Probability Engine — estimates approval likelihood at each workflow stage."""
import logging

logger = logging.getLogger(__name__)

# Base approval rates by TPA (approximations for demo)
TPA_BASE_RATES = {
    "Star Health": 0.82,
    "ICICI Lombard": 0.78,
    "HDFC ERGO": 0.80,
    "Bajaj Allianz": 0.76,
    "New India Assurance": 0.85,
    "United India": 0.83,
    "National Insurance": 0.81,
    "PMJAY": 0.90,
}

# Factor adjustments — positive means increases probability, negative decreases
MISSING_FIELD_IMPACTS = {
    "referral_letter": {"impact": -0.15, "label": "Referral letter missing", "tip": "30% of claims without referral letters face queries"},
    "doctor_notes": {"impact": -0.12, "label": "Doctor notes not attached", "tip": "Attach treating doctor's notes to avoid queries"},
    "investigation_reports": {"impact": -0.10, "label": "Investigation reports missing", "tip": "Include all lab/imaging reports"},
    "pre_auth_form": {"impact": -0.08, "label": "Pre-auth form incomplete", "tip": "Ensure all mandatory fields are filled"},
    "policy_number": {"impact": -0.05, "label": "Policy number not verified", "tip": "Verify policy is active before submission"},
    "diagnosis_code": {"impact": -0.10, "label": "No diagnosis code mapped", "tip": "AI couldn't map a standard ICD-10 code — manual entry needed"},
    "procedure_code": {"impact": -0.10, "label": "No procedure code mapped", "tip": "Missing CPT code reduces auto-approval chances"},
    "patient_id": {"impact": -0.03, "label": "Patient ID not linked", "tip": "Link hospital MRN/UHID for faster processing"},
    "admission_date": {"impact": -0.05, "label": "Admission date not set", "tip": "Required for all inpatient claims"},
}

# Stage-based adjustments
STAGE_MULTIPLIERS = {
    "PreAuth": 1.0,       # base probability
    "Submission": 1.02,    # slight boost — form is complete
    "QueryHandling": 0.85, # query means issues
    "Approval": 1.15,      # already approved, high confidence
    "Admission": 1.10,
    "BillGeneration": 1.05,
    "Enhancement": 0.95,   # enhancement means exceeding initial approval
    "Discharge": 1.08,
    "Settlement": 1.10,
    "Reconciliation": 1.0,
    "Closure": 1.0,
}


def calculate_claim_probability(case_data: dict) -> dict:
    """Calculate claim approval probability with factor breakdown.

    case_data should include:
    - tpa_name, current_stage, primary_diagnosis, primary_procedure
    - has_referral_letter, has_doctor_notes, has_investigation_reports
    - has_diagnosis_code, has_procedure_code, has_policy_number
    - has_admission_date, has_patient_id, has_pre_auth_form
    """

    # Start with TPA base rate
    tpa = case_data.get("tpa_name", "")
    base_rate = TPA_BASE_RATES.get(tpa, 0.80)

    # Apply missing field impacts
    factors = []
    probability = base_rate

    for field, config in MISSING_FIELD_IMPACTS.items():
        has_field = case_data.get(f"has_{field}", True)
        if not has_field:
            probability += config["impact"]
            factors.append({
                "field": field,
                "present": False,
                "impact": config["impact"],
                "impact_pct": f"{config['impact'] * 100:+.0f}%",
                "label": config["label"],
                "tip": config["tip"],
            })
        else:
            factors.append({
                "field": field,
                "present": True,
                "impact": 0,
                "impact_pct": "0%",
                "label": config["label"].replace("missing", "attached").replace("not", "").replace("No ", ""),
                "tip": "",
            })

    # Apply stage multiplier
    stage = case_data.get("current_stage", "PreAuth")
    stage_mult = STAGE_MULTIPLIERS.get(stage, 1.0)
    probability *= stage_mult

    # Clamp to 0-99% (never show 100%)
    probability = max(0.05, min(0.99, probability))

    # Generate suggestions for improvement
    suggestions = []
    missing_factors = [f for f in factors if not f["present"]]
    missing_factors.sort(key=lambda f: f["impact"])  # most negative first

    for f in missing_factors[:3]:  # top 3 suggestions
        suggestions.append({
            "action": f["label"],
            "impact": f["impact_pct"],
            "tip": f["tip"],
        })

    return {
        "probability": round(probability * 100, 1),
        "probability_label": _probability_label(probability),
        "base_rate": round(base_rate * 100, 1),
        "tpa_name": tpa or "General",
        "stage": stage,
        "stage_multiplier": stage_mult,
        "factors": factors,
        "missing_count": len(missing_factors),
        "suggestions": suggestions,
    }


def _probability_label(p: float) -> str:
    if p >= 0.85:
        return "High"
    elif p >= 0.65:
        return "Moderate"
    elif p >= 0.45:
        return "Low"
    else:
        return "Very Low"
