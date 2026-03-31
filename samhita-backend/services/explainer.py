"""Plain-Language Explanation Service — makes medical codes billing-staff-friendly."""
import os
import json
import logging
from models.document import SessionLocal, ExplanationCache

logger = logging.getLogger(__name__)

# Built-in explanations for common codes (avoids AI call for frequently seen codes)
BUILT_IN_EXPLANATIONS = {
    # CPT — Surgeries
    "27447": {"plain": "Total Knee Replacement", "billing": "Package procedure under most policies — check approved package rate. Implant cost often separate."},
    "27130": {"plain": "Total Hip Replacement", "billing": "Package procedure — verify implant reimbursement separately."},
    "33533": {"plain": "Coronary Artery Bypass Graft (CABG) — single arterial graft", "billing": "Major cardiac surgery — verify pre-auth covers number of grafts. ICU days often capped."},
    "33534": {"plain": "CABG — two arterial grafts", "billing": "Check if TPA approves multi-graft CABG at higher rate."},
    "44970": {"plain": "Laparoscopic Appendectomy", "billing": "Standard package procedure. If converted to open, use 44960 instead."},
    "47562": {"plain": "Laparoscopic Cholecystectomy (gallbladder removal)", "billing": "Common package procedure. Check if cholangiography is included or billable separately."},
    "59510": {"plain": "Cesarean Section (C-Section / LSCS)", "billing": "Check if vaginal delivery was attempted first — affects rate. Includes post-op care."},
    "59400": {"plain": "Normal Vaginal Delivery", "billing": "Includes antepartum, delivery, and postpartum care. Don't bill these separately."},
    "49505": {"plain": "Inguinal Hernia Repair", "billing": "If mesh used, implant may be billed separately. Check TPA policy."},
    "92928": {"plain": "Coronary Stent Placement (Angioplasty with stent)", "billing": "Stent cost usually separate. Verify DES vs BMS rate with TPA."},
    # CPT — Procedures
    "90935": {"plain": "Hemodialysis (single session)", "billing": "Per-session billing. Check approved number of sessions per week."},
    "43239": {"plain": "Upper GI Endoscopy with Biopsy", "billing": "Biopsy and pathology may be billable separately."},
    "45380": {"plain": "Colonoscopy with Biopsy", "billing": "Sedation and pathology may be additional charges."},
    "36556": {"plain": "Central Venous Catheter Insertion", "billing": "Often part of ICU package — verify if billable separately."},
    "93000": {"plain": "Electrocardiogram (ECG/EKG)", "billing": "Routine diagnostic test. Often included in admission package."},
    "71046": {"plain": "Chest X-Ray (2 views)", "billing": "Basic imaging — usually included in room package by some TPAs."},
    "74177": {"plain": "CT Scan of Abdomen and Pelvis with Contrast", "billing": "Contrast material may be billed separately."},
    "70553": {"plain": "MRI Brain with and without Contrast", "billing": "Contrast material separate. Pre-auth may be needed for MRI."},
    # ICD-10 — Common diagnoses
    "I25.10": {"plain": "Coronary Artery Disease (Atherosclerotic Heart Disease)", "billing": "Chronic condition — may affect pre-auth for procedures. Check policy for exclusion period."},
    "I21.0": {"plain": "Acute Heart Attack (ST Elevation MI — anterior wall)", "billing": "Emergency admission — pre-auth may be waived. 24-hour intimation required for most TPAs."},
    "K35.80": {"plain": "Acute Appendicitis (unspecified)", "billing": "Emergency — most TPAs cover without waiting period."},
    "K80.20": {"plain": "Gallstones without Obstruction", "billing": "Check waiting period for pre-existing conditions with this TPA."},
    "O82": {"plain": "Cesarean Delivery", "billing": "Some TPAs require justification for C-section over normal delivery."},
    "E11.9": {"plain": "Type 2 Diabetes (without complications)", "billing": "Pre-existing condition — may be excluded in first year or have waiting period."},
    "J18.9": {"plain": "Pneumonia (unspecified)", "billing": "Usually covered. If ICU needed, check approved ICU days."},
    "N17.9": {"plain": "Acute Kidney Failure (unspecified)", "billing": "May require dialysis — check approved sessions and consumables."},
    "M17.11": {"plain": "Osteoarthritis of Right Knee", "billing": "If leading to knee replacement, verify waiting period for pre-existing."},
    "S72.001A": {"plain": "Fracture of Right Femur (thigh bone)", "billing": "Trauma/accident — check if accident cover applies vs health cover."},
    # LOINC — Common lab tests
    "2160-0": {"plain": "Creatinine Blood Test (kidney function)", "billing": "Basic lab — usually part of admission package."},
    "2345-7": {"plain": "Blood Glucose Level", "billing": "Routine test — may be part of basic package."},
    "718-7": {"plain": "Hemoglobin Test", "billing": "Part of CBC — don't bill separately if CBC already charged."},
    "6690-2": {"plain": "White Blood Cell Count (WBC)", "billing": "Part of CBC — included in CBC charge."},
    "2951-2": {"plain": "Sodium Level in Blood", "billing": "Part of electrolyte panel — check if panel is billed or individual tests."},
    "2823-3": {"plain": "Potassium Level in Blood", "billing": "Part of electrolyte panel."},
}


def get_explanation(code: str, code_system: str, code_description: str = "") -> dict:
    """Get a plain-language explanation for a medical code.
    Returns dict with 'plain_explanation' and 'billing_notes'."""

    # Check built-in first
    builtin = BUILT_IN_EXPLANATIONS.get(code)
    if builtin:
        return {
            "plain_explanation": builtin["plain"],
            "billing_notes": builtin["billing"],
        }

    # Check database cache
    db = SessionLocal()
    try:
        cached = db.query(ExplanationCache).filter(
            ExplanationCache.code == code,
            ExplanationCache.code_system == code_system,
        ).first()
        if cached:
            return {
                "plain_explanation": cached.plain_explanation,
                "billing_notes": cached.billing_notes or "",
            }
    finally:
        db.close()

    # Generate explanation using AI
    explanation = _generate_explanation(code, code_system, code_description)

    # Cache it
    if explanation:
        db = SessionLocal()
        try:
            cache_entry = ExplanationCache(
                code=code,
                code_system=code_system,
                plain_explanation=explanation["plain_explanation"],
                billing_notes=explanation.get("billing_notes", ""),
            )
            db.add(cache_entry)
            db.commit()
        except Exception as e:
            logger.error(f"Failed to cache explanation for {code}: {e}")
            db.rollback()
        finally:
            db.close()

    return explanation


def get_explanations_batch(entities: list[dict]) -> list[dict]:
    """Add plain-language explanations to a list of coded entities."""
    result = []
    for entity in entities:
        code = entity.get("coded_value", "")
        code_system = entity.get("code_system", "")
        code_desc = entity.get("code_description", "")

        enriched = dict(entity)
        if code and code_system:
            explanation = get_explanation(code, code_system, code_desc)
            enriched["plain_explanation"] = explanation.get("plain_explanation", "")
            enriched["billing_notes"] = explanation.get("billing_notes", "")
        else:
            enriched["plain_explanation"] = ""
            enriched["billing_notes"] = ""
        result.append(enriched)
    return result


def _generate_explanation(code: str, code_system: str, code_description: str = "") -> dict:
    """Use Groq/Llama to generate a plain-language explanation."""
    try:
        from groq import Groq
        client = Groq(api_key=os.getenv("GROQ_API_KEY", ""))

        prompt = f"""You are a medical billing assistant. Explain this medical code in plain language for hospital billing staff who may not know medical terminology.

Code: {code}
System: {code_system}
Description: {code_description}

Reply in JSON format:
{{"plain_explanation": "Simple explanation of what this code means (1-2 sentences)", "billing_notes": "Key billing considerations — package rates, what's included/excluded, TPA tips (1-2 sentences)"}}

Reply ONLY with the JSON, no other text."""

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=300,
        )

        text = response.choices[0].message.content.strip()
        # Extract JSON from response
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
            text = text.strip()

        return json.loads(text)
    except Exception as e:
        logger.error(f"AI explanation generation failed for {code}: {e}")
        # Fallback
        return {
            "plain_explanation": code_description or f"{code_system} code {code}",
            "billing_notes": "Check with TPA for coverage details.",
        }
