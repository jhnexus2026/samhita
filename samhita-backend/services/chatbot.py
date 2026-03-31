"""Patient Chatbot — Groq/Llama powered Q&A scoped to patient records"""
import json
import os
import logging
from groq import Groq

logger = logging.getLogger(__name__)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_API_KEY_BACKUP = os.getenv("GROQ_API_KEY_BACKUP", "")

# Use the smaller, faster model for chat to save quota (NLP pipeline keeps the 70B)
CHAT_MODEL = "llama-3.1-8b-instant"

CHAT_SYSTEM_PROMPT = """You are Samhita AI, a clinical intelligence assistant embedded in a hospital management system. You help doctors, nurses, and billing staff understand patient records.

You have access to the current patient's normalized medical data (shown below). Answer questions ONLY based on this data. If information is not available in the patient context, say so clearly.

CAPABILITIES:
- Explain diagnoses, procedures, and medications in plain language
- Interpret lab results and flag abnormal values
- Explain medical codes (ICD-10, CPT, LOINC) and what they mean
- Summarize the patient's condition and treatment
- Answer billing and reconciliation questions
- Support Hindi/English responses (respond in the same language as the question)

RULES:
1. Never make clinical decisions — only explain existing data
2. Always cite the source (e.g., "According to the lab results...")
3. Flag critical/abnormal values when discussing labs or vitals
4. Keep responses concise but thorough
5. If asked about something not in the patient data, say "This information is not available in the current patient record."

PATIENT CONTEXT:
{patient_context}
"""


def build_patient_context(doc_data: dict) -> str:
    """Build a context string from document data for the chatbot."""
    sections = []

    # Patient info
    extracted = doc_data.get("extracted_data") or {}
    if extracted.get("patient_name"):
        sections.append(f"PATIENT: {extracted.get('patient_name', 'Unknown')}, "
                       f"Age: {extracted.get('patient_age', 'Unknown')}, "
                       f"Gender: {extracted.get('patient_gender', 'Unknown')}, "
                       f"ID: {extracted.get('patient_id', 'Unknown')}")
        sections.append(f"Admission: {extracted.get('admission_date', 'N/A')} | "
                       f"Discharge: {extracted.get('discharge_date', 'N/A')}")

    # Entities grouped by type
    entities = doc_data.get("entities") or []
    if entities:
        by_type = {}
        for e in entities:
            t = e.get("entity_type", "OTHER")
            by_type.setdefault(t, []).append(e)

        if "DIAGNOSIS" in by_type:
            diag_lines = []
            for e in by_type["DIAGNOSIS"]:
                neg = " [NEGATED/ABSENT]" if e.get("negated") else ""
                code = f" ({e['code_system']}: {e['coded_value']})" if e.get("coded_value") else ""
                conf = f" [confidence: {e['confidence']:.0%}]" if e.get("confidence") else ""
                diag_lines.append(f"  - {e.get('normalized_value', e['entity_text'])}{neg}{code}{conf}")
            sections.append("DIAGNOSES:\n" + "\n".join(diag_lines))

        if "PROCEDURE" in by_type:
            proc_lines = []
            for e in by_type["PROCEDURE"]:
                code = f" ({e['code_system']}: {e['coded_value']})" if e.get("coded_value") else ""
                proc_lines.append(f"  - {e.get('normalized_value', e['entity_text'])}{code}")
            sections.append("PROCEDURES:\n" + "\n".join(proc_lines))

        if "MEDICATION" in by_type:
            med_lines = [f"  - {e.get('normalized_value', e['entity_text'])}" for e in by_type["MEDICATION"]]
            sections.append("MEDICATIONS:\n" + "\n".join(med_lines))

        if "LAB_TEST" in by_type:
            lab_lines = []
            for e in by_type["LAB_TEST"]:
                code = f" (LOINC: {e['coded_value']})" if e.get("coded_value") else ""
                lab_lines.append(f"  - {e.get('normalized_value', e['entity_text'])}{code}")
            sections.append("LAB RESULTS:\n" + "\n".join(lab_lines))

        if "VITAL" in by_type:
            vital_lines = [f"  - {e.get('normalized_value', e['entity_text'])}" for e in by_type["VITAL"]]
            sections.append("VITALS:\n" + "\n".join(vital_lines))

    # Reconciliation alerts
    recon = doc_data.get("reconciliation_alerts") or []
    if recon:
        recon_lines = []
        for a in recon:
            recon_lines.append(f"  - [{a['alert_type']}] {a['description']} (Impact: Rs.{a.get('estimated_impact', 0)})")
        sections.append("BILLING RECONCILIATION ALERTS:\n" + "\n".join(recon_lines))

    # Overall stats
    sections.append(f"\nDOCUMENT STATUS: {doc_data.get('status', 'unknown')}")
    sections.append(f"OVERALL CONFIDENCE: {doc_data.get('confidence_score', 0):.0%}")

    return "\n\n".join(sections)


def _groq_call_with_failover(messages, model=None, temperature=0.3, max_tokens=1024, stream=False):
    """Call Groq with automatic failover to backup key on rate limit."""
    model = model or CHAT_MODEL
    keys = [GROQ_API_KEY, GROQ_API_KEY_BACKUP]
    
    for i, key in enumerate(keys):
        if not key:
            continue
        try:
            client = Groq(api_key=key)
            return client.chat.completions.create(
                model=model, messages=messages,
                temperature=temperature, max_tokens=max_tokens,
                stream=stream,
            )
        except Exception as e:
            if i == 0 and ("429" in str(e) or "rate" in str(e).lower()):
                logger.warning("Primary Groq key rate-limited for chat, switching to backup...")
                continue
            raise
    raise ValueError("All Groq API keys exhausted or not set")


def chat(patient_context: str, messages: list[dict]) -> str:
    """Send a chat message with patient context to Groq/Llama."""
    system_msg = CHAT_SYSTEM_PROMPT.format(patient_context=patient_context)

    all_messages = [{"role": "system", "content": system_msg}]
    all_messages.extend(messages)

    response = _groq_call_with_failover(all_messages)

    return response.choices[0].message.content.strip()

