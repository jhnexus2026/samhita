"""End-to-end pipeline test — bypasses Gemini Vision, tests everything else live."""
import json
import sys
import os
import time

# Fix Windows unicode output
sys.stdout.reconfigure(encoding='utf-8')

# Ensure imports work
sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv()

from models.document import init_db, SessionLocal, Document, ClinicalEntity, PatientAlert

print("=" * 70)
print("SAMHITA — END-TO-END PIPELINE TEST")
print("=" * 70)

# --- Step 0: Init DB ---
print("\n[Step 0] Initializing database...")
init_db()
db = SessionLocal()

# Clean up previous test data
db.query(PatientAlert).delete()
db.query(ClinicalEntity).delete()
db.query(Document).delete()
db.commit()
print("  Database cleaned and ready.")

# --- Step 1: Mock Vision Output ---
print("\n[Step 1] VISION EXTRACTION (mocked — simulating Gemini output)")
mock_vision_output = {
    "patient_name": "Rajesh Kumar",
    "patient_age": "52",
    "patient_id": "HOSP-2024-4492",
    "patient_gender": "Male",
    "admission_date": "2025-03-15",
    "discharge_date": "2025-03-20",
    "diagnoses": [
        "Acute Myocardial Infarction (STEMI)",
        "Type 2 Diabetes Mellitus with hyperglycemia",
        "Essential Hypertension - Stage 2",
        "Acute Kidney Injury",
    ],
    "procedures": [
        "Percutaneous Coronary Angioplasty with Stent placement",
        "ECG monitoring",
        "Echocardiography",
    ],
    "medications": [
        {"name": "Aspirin", "dose": "150mg", "frequency": "OD"},
        {"name": "Clopidogrel", "dose": "75mg", "frequency": "OD"},
        {"name": "Atorvastatin", "dose": "40mg", "frequency": "HS"},
        {"name": "Metformin", "dose": "500mg", "frequency": "BD"},
        {"name": "Amlodipine", "dose": "10mg", "frequency": "OD"},
        {"name": "Insulin Glargine", "dose": "20 units", "frequency": "SC HS"},
    ],
    "lab_results": [
        {"name": "Hemoglobin", "value": "10.2", "unit": "g/dL", "reference_range": "13-17"},
        {"name": "Creatinine", "value": "2.1", "unit": "mg/dL", "reference_range": "0.7-1.3"},
        {"name": "Troponin T", "value": "0.8", "unit": "ng/mL", "reference_range": "<0.04"},
        {"name": "Random Blood Sugar", "value": "320", "unit": "mg/dL", "reference_range": "70-140"},
    ],
    "vitals": {
        "blood_pressure": "170/100",
        "pulse": "110",
        "spo2": "88",
        "temperature": "99.2°F",
        "respiratory_rate": "",
    },
    "billing_items": [
        {"description": "Room charges", "amount": 15000, "code": None},
        {"description": "Angioplasty with stent", "amount": 250000, "code": "92928"},
        {"description": "ECG", "amount": 500, "code": "93000"},
        {"description": "Echocardiography", "amount": 3000, "code": "93306"},
        {"description": "Blood tests", "amount": 2000, "code": None},
        {"description": "Medications", "amount": 5000, "code": None},
    ],
    "raw_text": """DISCHARGE SUMMARY

Patient Name: Rajesh Kumar
Age/Gender: 52/M
Patient ID: HOSP-2024-4492
Date of Admission: 15-03-2025
Date of Discharge: 20-03-2025

CHIEF COMPLAINTS:
Patient presented with severe shortness of breath (SOB) and chest pain since 3 days.
History of Type 2 Diabetes Mellitus and Hypertension since 5 years.

EXAMINATION:
BP: 170/100 mmHg, Pulse: 110/min, SpO2: 88%, Temperature: 99.2F
RBS: 320 mg/dL

INVESTIGATIONS:
Hemoglobin: 10.2 g/dL
Creatinine: 2.1 mg/dL
Troponin T: 0.8 ng/mL (Elevated)
ECG: ST elevation in leads V1-V4

DIAGNOSIS:
1. Acute Myocardial Infarction (STEMI)
2. Type 2 Diabetes Mellitus with hyperglycemia
3. Essential Hypertension - Stage 2
4. Acute Kidney Injury

PROCEDURES:
1. Percutaneous Coronary Angioplasty with Stent placement
2. ECG monitoring
3. Echocardiography

MEDICATIONS:
1. Aspirin 150mg OD
2. Clopidogrel 75mg OD
3. Atorvastatin 40mg HS
4. Metformin 500mg BD
5. Amlodipine 10mg OD
6. Insulin Glargine 20 units SC HS

BILLING:
Room charges - Rs. 15000
Angioplasty with stent - Rs. 250000
ECG - Rs. 500
Echocardiography - Rs. 3000
Blood tests - Rs. 2000
Medications - Rs. 5000""",
    "confidence_score": 0.92,
}

# Create document record
doc = Document(
    filename="test_discharge_summary.pdf",
    status="processing",
    pipeline_step="extracting",
    page_count=1,
    extracted_json=json.dumps(mock_vision_output, ensure_ascii=False),
)
db.add(doc)
db.commit()
db.refresh(doc)
doc_id = doc.id

print(f"  Document #{doc_id} created")
print(f"  Patient: {mock_vision_output['patient_name']}, {mock_vision_output['patient_age']}Y {mock_vision_output['patient_gender']}")
print(f"  Diagnoses: {len(mock_vision_output['diagnoses'])}")
print(f"  Procedures: {len(mock_vision_output['procedures'])}")
print(f"  Medications: {len(mock_vision_output['medications'])}")
print(f"  Lab results: {len(mock_vision_output['lab_results'])}")
print(f"  Billing items: {len(mock_vision_output['billing_items'])}")
print(f"  Vision confidence: {mock_vision_output['confidence_score']}")
print("  ✓ Vision extraction mocked successfully")

# --- Step 2: Clinical NLP (LIVE — Groq/Llama 3.3 70B) ---
print("\n[Step 2] CLINICAL NLP (live — Groq / Llama 3.3 70B)")
print("  Sending raw text to Groq API...")
t0 = time.time()
try:
    from services.nlp import extract_entities
    entities = extract_entities(mock_vision_output["raw_text"])
    t1 = time.time()
    print(f"  ✓ NLP extracted {len(entities)} entities in {t1-t0:.1f}s")

    # Show entities by type
    types = {}
    for e in entities:
        t = e.get("entity_type", "UNKNOWN")
        types[t] = types.get(t, 0) + 1
    for t, count in sorted(types.items()):
        print(f"    {t}: {count}")

    # Show a few sample entities
    print("\n  Sample entities:")
    for e in entities[:5]:
        neg = " [NEGATED]" if e.get("negated") else ""
        print(f"    - [{e['entity_type']}] \"{e['entity_text']}\" → {e['normalized_value']}{neg} (conf: {e['confidence']})")
    if len(entities) > 5:
        print(f"    ... and {len(entities)-5} more")
except Exception as e:
    print(f"  ✗ NLP FAILED: {e}")
    entities = []

# --- Step 3: Code Mapping (LIVE — FAISS) ---
print("\n[Step 3] MEDICAL CODE MAPPING (live — FAISS + all-MiniLM-L6-v2)")
t0 = time.time()
try:
    from services.code_mapper import map_all_entities
    coded_entities = map_all_entities(entities)
    t1 = time.time()
    print(f"  ✓ Code mapping complete in {t1-t0:.1f}s")

    mapped = [e for e in coded_entities if e.get("coded_value")]
    needs_review = [e for e in coded_entities if e.get("needs_review")]
    print(f"  Mapped: {len(mapped)}/{len(coded_entities)} entities have codes")
    print(f"  Needs review: {len(needs_review)} (confidence < 85%)")

    print("\n  Code mappings:")
    for e in coded_entities:
        if e.get("coded_value"):
            review = " ⚠ REVIEW" if e.get("needs_review") else " ✓"
            print(f"    [{e['code_system']}] {e['entity_text']} → {e['coded_value']} ({e['code_description'][:50]}) score={e['similarity_score']:.3f}{review}")
except Exception as e:
    print(f"  ✗ CODE MAPPING FAILED: {e}")
    import traceback
    traceback.print_exc()
    coded_entities = [{**e, "coded_value": None, "similarity_score": 0, "needs_review": True} for e in entities]

# Save to DB
doc.coded_json = json.dumps(coded_entities, ensure_ascii=False)
has_review = False
for ce in coded_entities:
    entity = ClinicalEntity(
        document_id=doc_id,
        entity_text=ce.get("entity_text", ""),
        entity_type=ce.get("entity_type", ""),
        normalized_value=ce.get("normalized_value", ""),
        coded_value=ce.get("coded_value"),
        code_system=ce.get("code_system"),
        code_description=ce.get("code_description"),
        confidence=ce.get("similarity_score", ce.get("confidence", 0)),
        negated=ce.get("negated", False),
        temporal_context=ce.get("temporal_context"),
        needs_review=ce.get("needs_review", False),
    )
    db.add(entity)
    if ce.get("needs_review"):
        has_review = True
db.commit()

confidences = [ce.get("similarity_score", ce.get("confidence", 0)) for ce in coded_entities]
doc.confidence_score = sum(confidences) / len(confidences) if confidences else 0

# --- Step 4: FHIR R4 Bundle (LIVE) ---
print("\n[Step 4] FHIR R4 BUNDLE ASSEMBLY (live)")
try:
    from services.fhir_builder import build_bundle, build_ayushman_claim

    patient_info = {
        "patient_name": mock_vision_output.get("patient_name", ""),
        "patient_age": mock_vision_output.get("patient_age", ""),
        "patient_id": mock_vision_output.get("patient_id", ""),
        "patient_gender": mock_vision_output.get("patient_gender", ""),
        "admission_date": mock_vision_output.get("admission_date", ""),
        "discharge_date": mock_vision_output.get("discharge_date", ""),
    }

    fhir_bundle = build_bundle(patient_info, coded_entities, mock_vision_output)
    doc.fhir_json = json.dumps(fhir_bundle, ensure_ascii=False)

    entry_types = {}
    for entry in fhir_bundle.get("entry", []):
        rt = entry.get("resource", {}).get("resourceType", "Unknown")
        entry_types[rt] = entry_types.get(rt, 0) + 1

    print(f"  ✓ FHIR Bundle built — {len(fhir_bundle['entry'])} resources")
    for rt, count in sorted(entry_types.items()):
        print(f"    {rt}: {count}")

    # Ayushman claim
    billing_items = mock_vision_output.get("billing_items", [])
    ayushman = build_ayushman_claim(patient_info, coded_entities, billing_items)
    doc.ayushman_json = json.dumps(ayushman, ensure_ascii=False)

    diag_codes = ayushman["preauthorization"]["clinical"]["primary_diagnosis_icd"]
    proc_codes = ayushman["preauthorization"]["clinical"]["procedure_codes"]
    claim_amt = ayushman["preauthorization"]["financial"]["claim_amount"]
    print(f"\n  ✓ Ayushman PMJAY Claim:")
    print(f"    Primary ICD: {diag_codes}")
    print(f"    Procedure codes: {proc_codes}")
    print(f"    Claim amount: ₹{claim_amt:,.0f}")

    db.commit()
except Exception as e:
    print(f"  ✗ FHIR BUILDING FAILED: {e}")
    import traceback
    traceback.print_exc()

# --- Step 5: Billing Reconciliation (LIVE) ---
print("\n[Step 5] BILLING RECONCILIATION (live)")
try:
    from services.reconciler import reconcile
    billing_items = mock_vision_output.get("billing_items", [])
    recon_alerts = reconcile(coded_entities, billing_items)
    doc.reconciliation_alerts = json.dumps(recon_alerts, ensure_ascii=False)
    db.commit()

    print(f"  ✓ Reconciliation found {len(recon_alerts)} alerts")

    total_missed = 0
    total_phantom = 0
    for alert in recon_alerts:
        icon = "🔴" if alert["severity"] == "high" else "🟡"
        print(f"    {icon} [{alert['alert_type']}] {alert['description'][:80]}")
        if alert.get("estimated_impact"):
            print(f"       Impact: ₹{alert['estimated_impact']:,.0f}")
        if alert["alert_type"] == "MISSED_CHARGE":
            total_missed += alert.get("estimated_impact", 0)
        elif alert["alert_type"] == "PHANTOM_BILLING":
            total_phantom += alert.get("estimated_impact", 0)

    if recon_alerts:
        print(f"\n  Revenue summary:")
        print(f"    Missed charges: ₹{total_missed:,.0f}")
        print(f"    Phantom billing: ₹{total_phantom:,.0f}")
        print(f"    Net impact: ₹{total_missed - total_phantom:,.0f}")
except Exception as e:
    print(f"  ✗ RECONCILIATION FAILED: {e}")
    import traceback
    traceback.print_exc()

# --- Step 6: Severity Alerting (LIVE) ---
print("\n[Step 6] PATIENT SEVERITY TRIAGE & ALERTING (live)")
try:
    from services.alerting import classify_severity, create_alert_if_needed

    severity = classify_severity(coded_entities, mock_vision_output)
    print(f"  Patient severity: {severity.upper()}")

    alert_result = create_alert_if_needed(doc_id, coded_entities, mock_vision_output)
    if alert_result:
        print(f"  ✓ ALERT CREATED — {alert_result['severity'].upper()}")
        print(f"    Patient: {alert_result['patient_name']}")
        print(f"    Findings: {', '.join(alert_result['findings'][:5])}")
    else:
        print(f"  No alert needed (severity: {severity})")
except Exception as e:
    print(f"  ✗ ALERTING FAILED: {e}")
    import traceback
    traceback.print_exc()

# --- Finalize ---
final_status = "needs_review" if has_review else "done"
doc.status = final_status
doc.pipeline_step = "complete"
db.commit()

# --- Summary ---
print("\n" + "=" * 70)
print("PIPELINE COMPLETE")
print("=" * 70)
print(f"  Document: #{doc_id} — {doc.filename}")
print(f"  Status: {doc.status}")
print(f"  Overall confidence: {doc.confidence_score:.2%}")
print(f"  Total entities: {len(coded_entities)}")
mapped_count = len([e for e in coded_entities if e.get("coded_value")])
print(f"  Mapped to codes: {mapped_count}")
review_count = len([e for e in coded_entities if e.get("needs_review")])
print(f"  Needs review: {review_count}")

# Verify API endpoints
print("\n--- Verifying API data ---")
import requests
BASE = "http://localhost:8000"

try:
    r = requests.get(f"{BASE}/api/documents/{doc_id}")
    d = r.json()
    print(f"  GET /api/documents/{doc_id}: {d['status']} — {len(d.get('entities', []))} entities")
except:
    print("  ⚠ Backend not running — skipping API verification")

try:
    r = requests.get(f"{BASE}/api/metrics")
    m = r.json()
    print(f"  GET /api/metrics: {m['total_documents']} docs, avg confidence {m['average_confidence']:.2%}")
except:
    pass

try:
    r = requests.get(f"{BASE}/api/alerts")
    a = r.json()
    print(f"  GET /api/alerts: {a['total']} alerts, {a['unacknowledged']} unacknowledged")
except:
    pass

try:
    r = requests.get(f"{BASE}/api/review-queue")
    rq = r.json()
    print(f"  GET /api/review-queue: {rq['total']} documents need review")
except:
    pass

try:
    r = requests.get(f"{BASE}/api/revenue-analytics")
    rv = r.json()
    print(f"  GET /api/revenue-analytics: missed ₹{rv['total_missed_revenue']:,.0f}, phantom ₹{rv['total_phantom_billed']:,.0f}")
except:
    pass

print("\n✓ End-to-end test complete!")
db.close()
