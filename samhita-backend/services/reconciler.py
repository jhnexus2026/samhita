"""Billing Reconciliation Engine"""
import logging
from schemas.clinical import ReconciliationAlert

logger = logging.getLogger(__name__)

# Approximate procedure prices in INR — based on CGHS/PMJAY indicative rates
DEFAULT_PROCEDURE_PRICES = {
    # Surgeries
    "appendectomy": 45000,
    "laparoscopic appendectomy": 60000,
    "cholecystectomy": 55000,
    "laparoscopic cholecystectomy": 70000,
    "hernia repair": 40000,
    "inguinal hernia": 40000,
    "cesarean": 35000,
    "lscs": 35000,
    "c-section": 35000,
    "vaginal delivery": 18000,
    "cabg": 350000,
    "coronary artery bypass": 350000,
    "angioplasty": 250000,
    "stent": 250000,
    "pacemaker": 300000,
    "defibrillator": 500000,
    "knee replacement": 250000,
    "hip replacement": 280000,
    "fracture fixation": 80000,
    "internal fixation": 80000,
    "plate and screws": 80000,
    "spinal surgery": 300000,
    "laminectomy": 200000,
    "thyroidectomy": 60000,
    "mastectomy": 80000,
    "hysterectomy": 60000,
    "prostatectomy": 80000,
    "nephrectomy": 120000,
    "cystectomy": 150000,
    "colectomy": 120000,
    "gastrectomy": 150000,
    "whipple": 400000,
    "liver transplant": 2500000,
    "kidney transplant": 600000,
    # Procedures
    "dialysis": 5000,
    "hemodialysis": 5000,
    "endoscopy": 8000,
    "upper gi endoscopy": 8000,
    "colonoscopy": 10000,
    "bronchoscopy": 12000,
    "thoracentesis": 5000,
    "paracentesis": 5000,
    "lumbar puncture": 5000,
    "spinal tap": 5000,
    "central line": 8000,
    "catheterization": 50000,
    "angiography": 30000,
    "chemotherapy": 30000,
    "radiation": 50000,
    # Imaging
    "ct scan": 5000,
    "ct": 5000,
    "mri": 8000,
    "x-ray": 500,
    "ultrasound": 1500,
    "echocardiography": 3000,
    "echo": 3000,
    "ecg": 300,
    "ekg": 300,
    "stress test": 5000,
    "pet scan": 25000,
    # Labs
    "blood test": 500,
    "cbc": 400,
    "metabolic panel": 800,
    "lipid panel": 600,
    "thyroid": 700,
    "urine test": 200,
    "culture": 800,
    "biopsy": 5000,
    "pathology": 3000,
    # Other
    "physiotherapy": 1000,
    "icu": 15000,
    "ventilator": 10000,
    "blood transfusion": 3000,
    "oxygen therapy": 2000,
    "nebulization": 500,
}



def _estimate_price(procedure_text: str) -> float:
    """Estimate price based on procedure name."""
    text_lower = procedure_text.lower()
    for key, price in DEFAULT_PROCEDURE_PRICES.items():
        if key in text_lower:
            return float(price)
    return 5000.0  # Default estimate


def reconcile(coded_entities: list[dict], billing_items: list[dict]) -> list[dict]:
    """Compare coded clinical entities against billing items to find discrepancies."""
    alerts = []

    # Extract procedure and diagnosis codes from clinical entities
    clinical_procedures = {
        e.get("coded_value", ""): e
        for e in coded_entities
        if e.get("entity_type") == "PROCEDURE" and e.get("coded_value")
    }
    clinical_procedure_texts = {
        e.get("normalized_value", "").lower(): e
        for e in coded_entities
        if e.get("entity_type") == "PROCEDURE"
    }

    # Extract billing codes
    billed_codes = set()
    billed_descriptions = set()
    for item in billing_items:
        if item.get("code"):
            billed_codes.add(item["code"])
        if item.get("description"):
            billed_descriptions.add(item["description"].lower())

    # Rule 1: MISSED_CHARGE — documented procedure not in billing
    for code, entity in clinical_procedures.items():
        code_found = code in billed_codes
        text_found = any(
            entity.get("normalized_value", "").lower() in desc or desc in entity.get("normalized_value", "").lower()
            for desc in billed_descriptions
        )
        if not code_found and not text_found:
            est_price = _estimate_price(entity.get("normalized_value", ""))
            alerts.append({
                "alert_type": "MISSED_CHARGE",
                "severity": "high" if est_price > 10000 else "medium",
                "description": f"Procedure '{entity.get('normalized_value', entity.get('entity_text', ''))}' is documented in clinical notes but has no corresponding billing line item.",
                "entity_text": entity.get("entity_text", ""),
                "expected_code": code,
                "estimated_impact": est_price,
            })

    # Rule 2: PHANTOM_BILLING — billed item with no clinical evidence
    for item in billing_items:
        desc = item.get("description", "").lower()
        code = item.get("code", "")

        code_match = code and code in clinical_procedures
        text_match = any(
            desc in proc_text or proc_text in desc
            for proc_text in clinical_procedure_texts
        )

        # Skip generic items (room charges, consumables, etc.)
        generic_terms = ["room", "bed", "consumable", "nursing", "registration", "admission", "diet"]
        is_generic = any(term in desc for term in generic_terms)

        if not code_match and not text_match and not is_generic and desc:
            alerts.append({
                "alert_type": "PHANTOM_BILLING",
                "severity": "high",
                "description": f"Billing item '{item.get('description', '')}' (₹{item.get('amount', 0)}) has no supporting clinical documentation.",
                "entity_text": item.get("description", ""),
                "expected_code": code,
                "estimated_impact": item.get("amount", 0),
            })

    # Rule 3: DUPLICATE_BILLING — same code billed more than once
    code_counts = {}
    for item in billing_items:
        code = item.get("code", "")
        if code:
            code_counts[code] = code_counts.get(code, 0) + 1

    for code, count in code_counts.items():
        if count > 1:
            alerts.append({
                "alert_type": "DUPLICATE_BILLING",
                "severity": "medium",
                "description": f"Code '{code}' appears {count} times in billing. Verify if duplicate.",
                "entity_text": code,
                "expected_code": code,
                "estimated_impact": 0,
            })

    return alerts


def calculate_revenue_impact(alerts: list[dict]) -> dict:
    """Calculate total revenue impact from reconciliation alerts."""
    missed = sum(a.get("estimated_impact", 0) for a in alerts if a.get("alert_type") == "MISSED_CHARGE")
    phantom = sum(a.get("estimated_impact", 0) for a in alerts if a.get("alert_type") == "PHANTOM_BILLING")

    return {
        "total_missed_revenue": round(missed, 2),
        "total_phantom_billed": round(phantom, 2),
        "net_revenue_impact": round(missed - phantom, 2),
        "alert_count": len(alerts),
    }


def reconcile_case(case_data: dict) -> dict:
    """Case-level reconciliation: approved vs billed vs settled vs paid.

    case_data expects: approved_amount, total_billed, total_settled,
                       total_deductions, total_payments, bills, deductions
    """
    approved = case_data.get("approved_amount", 0)
    billed = case_data.get("total_billed", 0)
    settled = case_data.get("total_settled", 0)
    deductions = case_data.get("total_deductions", 0)
    payments = case_data.get("total_payments", 0)

    gaps = []

    # Gap 1: Billing vs Approved
    if approved > 0 and billed > approved:
        excess = billed - approved
        gaps.append({
            "type": "BILLING_EXCESS",
            "severity": "high",
            "description": f"Total billed ({billed:,.0f}) exceeds approved amount ({approved:,.0f}) by {excess:,.0f}",
            "amount": excess,
        })

    # Gap 2: Settlement shortfall
    if settled > 0 and billed > 0:
        shortfall = billed - settled
        if shortfall > 0:
            settlement_pct = settled / billed * 100
            gaps.append({
                "type": "SETTLEMENT_SHORTFALL",
                "severity": "high" if settlement_pct < 70 else "medium",
                "description": f"Settled only {settlement_pct:.0f}% of billed amount. Shortfall: {shortfall:,.0f}",
                "amount": shortfall,
            })

    # Gap 3: High deduction rate
    if deductions > 0 and billed > 0:
        deduction_pct = deductions / billed * 100
        if deduction_pct > 15:
            gaps.append({
                "type": "HIGH_DEDUCTIONS",
                "severity": "high" if deduction_pct > 30 else "medium",
                "description": f"Deduction rate is {deduction_pct:.0f}% of billed amount ({deductions:,.0f} in deductions)",
                "amount": deductions,
            })

    # Gap 4: Outstanding payments
    outstanding = billed - payments
    if outstanding > 0 and billed > 0:
        gaps.append({
            "type": "OUTSTANDING_BALANCE",
            "severity": "high" if outstanding / billed > 0.5 else "medium",
            "description": f"Outstanding balance: {outstanding:,.0f} (received {payments:,.0f} of {billed:,.0f} billed)",
            "amount": outstanding,
        })

    # Revenue leakage summary
    leakage = billed - settled if settled > 0 else 0

    return {
        "summary": {
            "approved_amount": approved,
            "total_billed": billed,
            "total_settled": settled,
            "total_deductions": deductions,
            "total_payments": payments,
            "outstanding_balance": outstanding if outstanding > 0 else 0,
            "revenue_leakage": leakage,
            "recovery_rate": round(settled / billed * 100, 1) if billed > 0 else 0,
        },
        "gaps": gaps,
        "gap_count": len(gaps),
        "high_severity_count": sum(1 for g in gaps if g["severity"] == "high"),
    }


def categorize_deductions(deductions: list[dict]) -> dict:
    """Categorize deductions by reason for analysis."""
    categories = {
        "disallowance": {"label": "Disallowance", "total": 0, "count": 0, "items": []},
        "excess": {"label": "Excess Charges", "total": 0, "count": 0, "items": []},
        "policy_exclusion": {"label": "Policy Exclusion", "total": 0, "count": 0, "items": []},
        "copay": {"label": "Co-pay / Co-insurance", "total": 0, "count": 0, "items": []},
        "proportional": {"label": "Proportional Deduction", "total": 0, "count": 0, "items": []},
        "other": {"label": "Other", "total": 0, "count": 0, "items": []},
    }

    for d in deductions:
        cat = d.get("category", "other")
        if cat not in categories:
            cat = "other"
        categories[cat]["total"] += d.get("amount", 0)
        categories[cat]["count"] += 1
        categories[cat]["items"].append(d.get("reason", ""))

    # Filter out empty categories
    return {k: v for k, v in categories.items() if v["count"] > 0}
