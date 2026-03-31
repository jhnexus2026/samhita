"""Gemini 2.0 Flash Vision — Document Understanding Service"""
from google import genai
from google.genai import types
import base64
import json
import os
import logging
from PIL import Image
from schemas.clinical import VisionExtractionSchema

logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

VISION_PROMPT = """You are a medical document analysis AI. Analyze this hospital document image and extract ALL information into structured JSON.

IMPORTANT RULES:
1. Return ONLY valid JSON, no markdown, no explanation, no extra text.
2. Read EVERYTHING: typed text, printed tables, handwritten notes, stamps, headers, footers.
3. Handle Hindi-English mixed text (Hinglish). Translate Hindi to English where possible.
4. For handwritten text, do your best to decipher. Mark confidence lower if uncertain.
5. Never hallucinate — if a field is not present, use empty string or empty list.
6. Extract ALL billing line items with amounts.
7. For lab results, always include reference ranges if visible.

Return this exact JSON structure:
{
  "doc_type": "string (one of: pre_auth, discharge_summary, prescription, lab_report, bill, general)",
  "patient_name": "string",
  "patient_age": "string",
  "patient_id": "string",
  "patient_gender": "string",
  "admission_date": "string",
  "discharge_date": "string",
  "diagnoses": ["string array of all diagnoses mentioned"],
  "procedures": ["string array of all procedures mentioned"],
  "medications": [
    {"name": "string", "dose": "string", "frequency": "string"}
  ],
  "lab_results": [
    {"name": "string", "value": "string", "unit": "string", "reference_range": "string"}
  ],
  "vitals": {
    "blood_pressure": "string",
    "pulse": "string",
    "temperature": "string",
    "spo2": "string",
    "respiratory_rate": "string"
  },
  "billing_items": [
    {"description": "string", "amount": 0.0, "code": "string or null"}
  ],
  "raw_text": "complete extracted text from the document",
  "confidence_score": 0.0 to 1.0
}"""


def extract_from_image(image_path: str) -> dict:
    """Extract structured medical data from a document image using Gemini Vision."""
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY not set. Get one at aistudio.google.com")

    client = genai.Client(api_key=GEMINI_API_KEY)

    # Load and encode image
    img = Image.open(image_path)

    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=[VISION_PROMPT, img],
        config=types.GenerateContentConfig(
            temperature=0.1,
            max_output_tokens=4096,
        ),
    )

    # Parse JSON from response
    text = response.text.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse Gemini response as JSON: {e}")
        logger.error(f"Raw response: {text[:500]}")
        # Return minimal structure with raw text
        data = {
            "doc_type": "general",
            "patient_name": "",
            "patient_age": "",
            "patient_id": "",
            "patient_gender": "",
            "diagnoses": [],
            "procedures": [],
            "medications": [],
            "lab_results": [],
            "vitals": {},
            "billing_items": [],
            "raw_text": text,
            "confidence_score": 0.3,
        }

    return data


def extract_multi_page(page_paths: list[str]) -> dict:
    """Extract and merge data from multiple pages of a document."""
    all_extractions = []
    for path in page_paths:
        try:
            extraction = extract_from_image(path)
            all_extractions.append(extraction)
        except Exception as e:
            logger.error(f"Vision extraction failed for {path}: {e}")
            all_extractions.append({"raw_text": "", "confidence_score": 0.0})

    if not all_extractions:
        return {}

    # Merge: use first page for patient info, combine lists from all pages
    merged = all_extractions[0].copy()
    if "doc_type" not in merged or not merged["doc_type"]:
        merged["doc_type"] = "general"
    for ext in all_extractions[1:]:
        merged["diagnoses"] = list(set(merged.get("diagnoses", []) + ext.get("diagnoses", [])))
        merged["procedures"] = list(set(merged.get("procedures", []) + ext.get("procedures", [])))
        merged["medications"] = merged.get("medications", []) + ext.get("medications", [])
        merged["lab_results"] = merged.get("lab_results", []) + ext.get("lab_results", [])
        merged["billing_items"] = merged.get("billing_items", []) + ext.get("billing_items", [])
        merged["raw_text"] = merged.get("raw_text", "") + "\n\n---PAGE BREAK---\n\n" + ext.get("raw_text", "")

        # Use patient info from first page that has it
        if not merged.get("patient_name") and ext.get("patient_name"):
            merged["patient_name"] = ext["patient_name"]
            merged["patient_age"] = ext.get("patient_age", "")
            merged["patient_id"] = ext.get("patient_id", "")
            merged["patient_gender"] = ext.get("patient_gender", "")

    # Average confidence across pages
    scores = [e.get("confidence_score", 0) for e in all_extractions if e.get("confidence_score")]
    merged["confidence_score"] = sum(scores) / len(scores) if scores else 0.0

    return merged
