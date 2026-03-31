"""Clinical NLP Engine — Groq / Llama 3.3 70B with auto-failover"""
import json
import os
import re
import logging
from groq import Groq
from schemas.clinical import ClinicalEntitySchema

logger = logging.getLogger(__name__)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_API_KEY_BACKUP = os.getenv("GROQ_API_KEY_BACKUP", "")

def _get_groq_client(use_backup=False):
    """Get a Groq client, using backup key if specified."""
    key = GROQ_API_KEY_BACKUP if use_backup else GROQ_API_KEY
    if not key:
        raise ValueError("GROQ_API_KEY not set. Get one at console.groq.com")
    return Groq(api_key=key)


NLP_SYSTEM_PROMPT = """You are a clinical NLP engine for Indian hospital documents. Your job is to extract medical named entities from raw clinical text.

RULES:
1. Return ONLY a valid JSON array. No markdown, no explanation, no extra text.
2. Each entity must have these exact fields:
   - entity_text: the exact text from the document
   - entity_type: one of DIAGNOSIS, PROCEDURE, MEDICATION, LAB_TEST, VITAL, DEMOGRAPHIC
   - normalized_value: standardized medical term (expand abbreviations)
   - negated: true if the condition is denied/absent/negative
   - temporal_context: temporal info if present (e.g., "post-operative day 2", "since 3 days")
   - confidence: 0.0 to 1.0

3. ABBREVIATION EXPANSION:
   - SOB → Shortness of Breath
   - HTN → Hypertension
   - DM → Diabetes Mellitus
   - RBS → Random Blood Sugar
   - BP → Blood Pressure
   - CAD → Coronary Artery Disease
   - COPD → Chronic Obstructive Pulmonary Disease
   - CKD → Chronic Kidney Disease
   - OHA → Oral Hypoglycemic Agent
   - LSCS → Lower Segment Cesarean Section

4. NEGATION DETECTION:
   - "denies chest pain" → negated: true
   - "no fever" → negated: true
   - "rules out MI" → negated: true
   - "negative for malaria" → negated: true

5. Extract EVERYTHING: diagnoses, procedures, medications (with dose), lab values, vitals, demographics.

6. LAB TEST HANDLING (CRITICAL):
   - ALWAYS combine a lab parameter name with its value into ONE entity.
   - NEVER create separate entities for a parameter name and its value.
   - entity_text should be "ParameterName Value Unit" (e.g., "WBC 5.03 10^3/uL")
   - normalized_value should be "Full Name: Value Unit (Ref: range)" when reference range is available
   - For tabular lab reports (CBC, LFT, RFT, etc.), each row = one entity combining name + result + unit + reference range.
   - WRONG: {"entity_text": "WBC"} and {"entity_text": "5.03"} as separate entities
   - RIGHT: {"entity_text": "WBC 5.03 10^3/uL", "normalized_value": "White Blood Cell Count: 5.03 ×10^3/µL (Ref: 4.00-10.00)"}

FEW-SHOT EXAMPLES:

Input: "Patient Rajesh Kumar, 45M, admitted with SOB and chest pain. Denies fever. BP 140/90. RBS 250mg/dl. Diagnosed with Type 2 DM and HTN. Underwent CABG. Started on Metformin 500mg BD and Amlodipine 5mg OD."

Output:
[
  {"entity_text": "Rajesh Kumar", "entity_type": "DEMOGRAPHIC", "normalized_value": "Patient Name: Rajesh Kumar", "negated": false, "temporal_context": null, "confidence": 0.95},
  {"entity_text": "45M", "entity_type": "DEMOGRAPHIC", "normalized_value": "Age: 45, Gender: Male", "negated": false, "temporal_context": null, "confidence": 0.95},
  {"entity_text": "SOB", "entity_type": "DIAGNOSIS", "normalized_value": "Shortness of Breath", "negated": false, "temporal_context": null, "confidence": 0.9},
  {"entity_text": "chest pain", "entity_type": "DIAGNOSIS", "normalized_value": "Chest Pain", "negated": false, "temporal_context": null, "confidence": 0.95},
  {"entity_text": "fever", "entity_type": "DIAGNOSIS", "normalized_value": "Fever", "negated": true, "temporal_context": null, "confidence": 0.9},
  {"entity_text": "BP 140/90", "entity_type": "VITAL", "normalized_value": "Blood Pressure: 140/90 mmHg", "negated": false, "temporal_context": null, "confidence": 0.95},
  {"entity_text": "RBS 250mg/dl", "entity_type": "LAB_TEST", "normalized_value": "Random Blood Sugar: 250 mg/dL", "negated": false, "temporal_context": null, "confidence": 0.95},
  {"entity_text": "Type 2 DM", "entity_type": "DIAGNOSIS", "normalized_value": "Type 2 Diabetes Mellitus", "negated": false, "temporal_context": null, "confidence": 0.95},
  {"entity_text": "HTN", "entity_type": "DIAGNOSIS", "normalized_value": "Hypertension", "negated": false, "temporal_context": null, "confidence": 0.9},
  {"entity_text": "CABG", "entity_type": "PROCEDURE", "normalized_value": "Coronary Artery Bypass Grafting", "negated": false, "temporal_context": null, "confidence": 0.95},
  {"entity_text": "Metformin 500mg BD", "entity_type": "MEDICATION", "normalized_value": "Metformin 500mg twice daily", "negated": false, "temporal_context": null, "confidence": 0.95},
  {"entity_text": "Amlodipine 5mg OD", "entity_type": "MEDICATION", "normalized_value": "Amlodipine 5mg once daily", "negated": false, "temporal_context": null, "confidence": 0.95}
]

Input: "Post-op Day 2 after laparoscopic appendectomy. Patient afebrile. No wound infection. Hemoglobin 11.2 g/dL."

Output:
[
  {"entity_text": "laparoscopic appendectomy", "entity_type": "PROCEDURE", "normalized_value": "Laparoscopic Appendectomy", "negated": false, "temporal_context": "post-operative day 2", "confidence": 0.95},
  {"entity_text": "afebrile", "entity_type": "VITAL", "normalized_value": "No Fever (Afebrile)", "negated": true, "temporal_context": "post-operative day 2", "confidence": 0.9},
  {"entity_text": "wound infection", "entity_type": "DIAGNOSIS", "normalized_value": "Wound Infection", "negated": true, "temporal_context": "post-operative day 2", "confidence": 0.9},
  {"entity_text": "Hemoglobin 11.2 g/dL", "entity_type": "LAB_TEST", "normalized_value": "Hemoglobin: 11.2 g/dL", "negated": false, "temporal_context": "post-operative day 2", "confidence": 0.95}
]

Input: "WBC 5.03 10^3/uL 4.00-10.00 | Neu# 2.88 10^3/uL 2.00-7.00 | Lym# 1.77 10^3/uL 0.80-4.00 | RBC 4.17 10^6/uL 4.00-6.20 | HGB 11.4 g/dL 12.0-16.0 | PLT 132 10^3/uL 100-400"

Output:
[
  {"entity_text": "WBC 5.03 10^3/uL", "entity_type": "LAB_TEST", "normalized_value": "White Blood Cell Count: 5.03 ×10^3/µL (Ref: 4.00-10.00)", "negated": false, "temporal_context": null, "confidence": 0.95},
  {"entity_text": "Neu# 2.88 10^3/uL", "entity_type": "LAB_TEST", "normalized_value": "Neutrophil Count: 2.88 ×10^3/µL (Ref: 2.00-7.00)", "negated": false, "temporal_context": null, "confidence": 0.95},
  {"entity_text": "Lym# 1.77 10^3/uL", "entity_type": "LAB_TEST", "normalized_value": "Lymphocyte Count: 1.77 ×10^3/µL (Ref: 0.80-4.00)", "negated": false, "temporal_context": null, "confidence": 0.95},
  {"entity_text": "RBC 4.17 10^6/uL", "entity_type": "LAB_TEST", "normalized_value": "Red Blood Cell Count: 4.17 ×10^6/µL (Ref: 4.00-6.20)", "negated": false, "temporal_context": null, "confidence": 0.95},
  {"entity_text": "HGB 11.4 g/dL", "entity_type": "LAB_TEST", "normalized_value": "Hemoglobin: 11.4 g/dL (Ref: 12.0-16.0)", "negated": false, "temporal_context": null, "confidence": 0.95},
  {"entity_text": "PLT 132 10^3/uL", "entity_type": "LAB_TEST", "normalized_value": "Platelet Count: 132 ×10^3/µL (Ref: 100-400)", "negated": false, "temporal_context": null, "confidence": 0.95}
]

Now extract entities from the following clinical text:"""


def _call_groq(client, model, messages, temperature=0.1, max_tokens=4096):
    """Call Groq with auto-failover to backup key on rate limit."""
    try:
        return client.chat.completions.create(
            model=model, messages=messages,
            temperature=temperature, max_tokens=max_tokens,
        )
    except Exception as e:
        if "429" in str(e) or "rate" in str(e).lower():
            logger.warning(f"Primary Groq key rate-limited, switching to backup...")
            backup_client = _get_groq_client(use_backup=True)
            return backup_client.chat.completions.create(
                model=model, messages=messages,
                temperature=temperature, max_tokens=max_tokens,
            )
        raise


def _is_numeric_value(text: str) -> bool:
    """Check if text is a standalone numeric lab value (e.g., '5.03', '132', '0.126')."""
    t = text.strip()
    return bool(re.match(r'^-?\d+\.?\d*$', t))


def _is_lab_name(text: str) -> bool:
    """Check if text looks like a lab parameter name (non-numeric, short)."""
    t = text.strip()
    if _is_numeric_value(t):
        return False
    # Lab parameter names are typically short (WBC, Neu#, HGB, RBC, PLT, etc.)
    return len(t) <= 30 and not t.replace('#', '').replace('%', '').replace('-', '').replace('*', '').isdigit()


def _merge_split_lab_entities(entities: list[dict]) -> list[dict]:
    """Post-process: merge consecutive LAB_TEST entities where one is a name and the next is a value."""
    if len(entities) < 2:
        return entities

    merged = []
    i = 0
    while i < len(entities):
        ent = entities[i]
        # Check if this is a LAB_TEST name followed by a LAB_TEST numeric value
        if (
            i + 1 < len(entities)
            and ent.get("entity_type") == "LAB_TEST"
            and entities[i + 1].get("entity_type") == "LAB_TEST"
            and _is_lab_name(ent.get("entity_text", ""))
            and _is_numeric_value(entities[i + 1].get("entity_text", ""))
        ):
            name_ent = ent
            value_ent = entities[i + 1]
            name_text = name_ent["entity_text"].strip()
            value_text = value_ent["entity_text"].strip()

            # Build combined entity
            combined_text = f"{name_text} {value_text}"

            # Try to get unit from the value entity's normalized_value
            norm_val = value_ent.get("normalized_value", "")
            # Extract unit if present (e.g., "White Blood Cell Count: 5.03 ×10^3/µL")
            unit_match = re.search(r'[\d.]+\s*(.*)', norm_val.split(":")[-1].strip()) if ":" in norm_val else None
            unit = unit_match.group(1).strip() if unit_match else ""
            if unit:
                combined_text = f"{name_text} {value_text} {unit}"

            # Use the more descriptive normalized_value (usually from the value entity)
            combined_norm = value_ent.get("normalized_value") or name_ent.get("normalized_value", "")
            if not combined_norm or combined_norm == value_text:
                name_norm = name_ent.get("normalized_value", name_text)
                combined_norm = f"{name_norm}: {value_text}"

            merged_entity = {
                "entity_text": combined_text,
                "entity_type": "LAB_TEST",
                "normalized_value": combined_norm,
                "negated": False,
                "temporal_context": name_ent.get("temporal_context") or value_ent.get("temporal_context"),
                "confidence": max(name_ent.get("confidence", 0), value_ent.get("confidence", 0)),
            }
            merged.append(merged_entity)
            logger.info(f"Merged split lab entities: '{name_text}' + '{value_text}' → '{combined_text}'")
            i += 2  # Skip both entities
        else:
            merged.append(ent)
            i += 1

    return merged


def extract_entities(raw_text: str) -> list[dict]:
    """Extract clinical entities from raw text using Groq/Llama with auto-failover."""
    client = _get_groq_client()

    response = _call_groq(
        client,
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": NLP_SYSTEM_PROMPT},
            {"role": "user", "content": raw_text},
        ],
        temperature=0.1,
        max_tokens=4096,
    )

    text = response.choices[0].message.content.strip()

    # Strip markdown code fences if present
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

    try:
        entities = json.loads(text)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse NLP response: {e}")
        logger.error(f"Raw: {text[:500]}")
        return []

    if not isinstance(entities, list):
        logger.error("NLP response is not a list")
        return []

    # Validate each entity with Pydantic
    validated = []
    for ent in entities:
        if not isinstance(ent, dict):
            logger.warning(f"Skipping non-dict entity: {ent}")
            continue
        try:
            schema = ClinicalEntitySchema(**ent)
            validated.append(schema.model_dump())
        except Exception as e:
            logger.warning(f"Entity validation failed: {e} — {ent}")
            # Still include with defaults
            validated.append({
                "entity_text": ent.get("entity_text", ""),
                "entity_type": ent.get("entity_type", "DIAGNOSIS"),
                "normalized_value": ent.get("normalized_value", ent.get("entity_text", "")),
                "negated": ent.get("negated", False),
                "temporal_context": ent.get("temporal_context"),
                "confidence": ent.get("confidence", 0.5),
            })

    # Post-process: merge split lab test entities (name + value as separate entries)
    validated = _merge_split_lab_entities(validated)

    return validated
