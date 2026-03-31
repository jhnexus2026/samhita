import os
import json
from datetime import datetime, timedelta
from decimal import Decimal
from dotenv import load_dotenv
load_dotenv()

from sqlalchemy.orm import Session
from models.document import (
    SessionLocal, Document, ClinicalEntity, PatientAlert,
    Patient, Case, PreAuth, Bill, BillItem, Payment,
    Settlement, Deduction, StateTransition, init_db,
)


def seed_data():
    db = SessionLocal()
    init_db()

    print("Seeding Demo Data...")

    # ─── CASE 1: Anita Iyer — Cardiac (Settlement stage) ─────────────────
    p1 = Patient(name="Anita Iyer", age="62", gender="Female", patient_id_external="MRN-4821")
    db.add(p1)
    db.flush()

    c1 = Case(
        case_number="SAM-2026-00001", patient_id=p1.id, current_stage="Settlement",
        status="active", tpa_name="Star Health", policy_number="SH-2024-889921",
        insurance_company="Star Health Insurance",
        primary_diagnosis="Acute Myocardial Infarction", primary_diagnosis_code="I21.9",
        primary_procedure="Coronary Angioplasty with Stent", primary_procedure_code="92928",
        admission_date=datetime.utcnow() - timedelta(days=5),
        discharge_date=datetime.utcnow() - timedelta(days=1),
    )
    db.add(c1)
    db.flush()

    pa1 = PreAuth(case_id=c1.id, requested_amount=Decimal("350000"), approved_amount=Decimal("300000"),
                  approval_status="approved", approval_reference="SH-AUTH-20260325-4821",
                  validity_days=30, submitted_at=datetime.utcnow() - timedelta(days=6),
                  approved_at=datetime.utcnow() - timedelta(days=5, hours=12))
    db.add(pa1)

    bill1 = Bill(case_id=c1.id, bill_number="BILL-SAM-2026-00001-001", bill_type="final",
                 total_amount=Decimal("285000"), status="submitted")
    db.add(bill1)
    db.flush()

    items1 = [
        BillItem(bill_id=bill1.id, description="Coronary Angioplasty", code="92928", category="surgery", quantity=1, unit_price=Decimal("150000"), amount=Decimal("150000")),
        BillItem(bill_id=bill1.id, description="Drug Eluting Stent (DES)", code="", category="consumable", quantity=1, unit_price=Decimal("65000"), amount=Decimal("65000")),
        BillItem(bill_id=bill1.id, description="ICU (3 days)", code="", category="room", quantity=3, unit_price=Decimal("12000"), amount=Decimal("36000")),
        BillItem(bill_id=bill1.id, description="Medicines & Consumables", code="", category="pharmacy", quantity=1, unit_price=Decimal("18000"), amount=Decimal("18000")),
        BillItem(bill_id=bill1.id, description="Lab Investigations", code="", category="lab", quantity=1, unit_price=Decimal("8000"), amount=Decimal("8000")),
        BillItem(bill_id=bill1.id, description="ECG + Echo", code="93000", category="lab", quantity=1, unit_price=Decimal("8000"), amount=Decimal("8000")),
    ]
    db.add_all(items1)

    s1 = Settlement(case_id=c1.id, billed_amount=Decimal("285000"), approved_amount=Decimal("300000"),
                    settled_amount=Decimal("262000"), total_deductions=Decimal("23000"),
                    patient_liability=Decimal("23000"), status="settled")
    db.add(s1)
    db.flush()
    db.add_all([
        Deduction(settlement_id=s1.id, reason="Room rent excess over policy limit", category="excess", amount=Decimal("6000")),
        Deduction(settlement_id=s1.id, reason="Non-payable consumables", category="disallowance", amount=Decimal("12000")),
        Deduction(settlement_id=s1.id, reason="Co-pay 5%", category="copay", amount=Decimal("5000")),
    ])

    d1 = Document(filename="Anita Iyer — Discharge Summary.pdf", status="done", pipeline_step="done",
                  confidence_score=0.98, case_id=c1.id, doc_type="discharge_summary",
                  extracted_json=json.dumps({"patient_name": "Anita Iyer", "patient_age": "62", "patient_gender": "Female", "patient_id": "MRN-4821", "raw_text": "Pt Anita Iyer, 62F, acute chest pain. Acute MI. Coronary Angioplasty with DES."}),
                  created_at=datetime.utcnow() - timedelta(days=1))
    db.add(d1)
    db.flush()
    db.add_all([
        ClinicalEntity(document_id=d1.id, entity_text="Acute Myocardial Infarction", entity_type="DIAGNOSIS", coded_value="I21.9", code_system="ICD10", code_description="Acute myocardial infarction, unspecified", confidence=0.99),
        ClinicalEntity(document_id=d1.id, entity_text="Coronary Angioplasty", entity_type="PROCEDURE", coded_value="92928", code_system="CPT", code_description="Percutaneous coronary intervention with stent", confidence=0.97),
        ClinicalEntity(document_id=d1.id, entity_text="Atorvastatin 40mg", entity_type="MEDICATION", normalized_value="Atorvastatin", confidence=0.95),
        PatientAlert(document_id=d1.id, case_id=c1.id, patient_name="Anita Iyer", severity="critical", flagged_findings="POST-MI: dual antiplatelet therapy required"),
    ])

    # Transitions for case 1
    for from_s, to_s, hrs in [("Created","PreAuth",120), ("PreAuth","Submission",118), ("Submission","Approval",96), ("Approval","Admission",72), ("Admission","BillGeneration",48), ("BillGeneration","Discharge",24), ("Discharge","Settlement",2)]:
        db.add(StateTransition(case_id=c1.id, from_stage=from_s, to_stage=to_s, action=f"advanced_to_{to_s}", performed_by="billing_staff", created_at=datetime.utcnow() - timedelta(hours=hrs)))

    # ─── CASE 2: Vikram Singh — Diabetes/CKD (BillGeneration stage) ──────
    p2 = Patient(name="Vikram Singh", age="54", gender="Male", patient_id_external="MRN-7734")
    db.add(p2)
    db.flush()

    c2 = Case(
        case_number="SAM-2026-00002", patient_id=p2.id, current_stage="BillGeneration",
        status="active", tpa_name="ICICI Lombard", policy_number="IL-2025-112233",
        insurance_company="ICICI Lombard GIC",
        primary_diagnosis="Type 2 Diabetes with CKD Stage 3", primary_diagnosis_code="E11.22",
        primary_procedure="Dialysis", primary_procedure_code="90935",
        admission_date=datetime.utcnow() - timedelta(days=3),
    )
    db.add(c2)
    db.flush()

    pa2 = PreAuth(case_id=c2.id, requested_amount=Decimal("120000"), approved_amount=Decimal("100000"),
                  approval_status="approved", approval_reference="ICL-AUTH-20260326",
                  submitted_at=datetime.utcnow() - timedelta(days=4),
                  approved_at=datetime.utcnow() - timedelta(days=3, hours=6))
    db.add(pa2)

    bill2 = Bill(case_id=c2.id, bill_number="BILL-SAM-2026-00002-001", bill_type="interim",
                 total_amount=Decimal("78000"), status="draft")
    db.add(bill2)
    db.flush()
    db.add_all([
        BillItem(bill_id=bill2.id, description="Dialysis x3 sessions", code="90935", category="procedure", quantity=3, unit_price=Decimal("5000"), amount=Decimal("15000")),
        BillItem(bill_id=bill2.id, description="Room (3 days)", code="", category="room", quantity=3, unit_price=Decimal("8000"), amount=Decimal("24000")),
        BillItem(bill_id=bill2.id, description="Medicines", code="", category="pharmacy", quantity=1, unit_price=Decimal("22000"), amount=Decimal("22000")),
        BillItem(bill_id=bill2.id, description="Lab Investigations", code="", category="lab", quantity=1, unit_price=Decimal("9000"), amount=Decimal("9000")),
        BillItem(bill_id=bill2.id, description="Nephrology Consultation", code="", category="consultation", quantity=2, unit_price=Decimal("4000"), amount=Decimal("8000")),
    ])

    d2 = Document(filename="Vikram Singh — Lab Report.png", status="needs_review", pipeline_step="done",
                  confidence_score=0.92, case_id=c2.id, doc_type="pre_auth",
                  extracted_json=json.dumps({"patient_name": "Vikram Singh", "patient_age": "54", "patient_gender": "Male", "patient_id": "MRN-7734", "raw_text": "HbA1c: 9.4%, Creatinine: 1.8. Diabetes Type 2, CKD Stage 3."}),
                  created_at=datetime.utcnow() - timedelta(days=3))
    db.add(d2)
    db.flush()
    db.add_all([
        ClinicalEntity(document_id=d2.id, entity_text="HbA1c: 9.4%", entity_type="LAB_TEST", coded_value="4548-4", code_system="LOINC", confidence=0.94),
        ClinicalEntity(document_id=d2.id, entity_text="Diabetes Mellitus Type 2", entity_type="DIAGNOSIS", coded_value="E11.9", code_system="ICD10", confidence=0.88),
        PatientAlert(document_id=d2.id, case_id=c2.id, patient_name="Vikram Singh", severity="high", flagged_findings="UNCONTROLLED DIABETES: HbA1c 9.4%, Creatinine 1.8 = early CKD Stage 3"),
    ])

    for from_s, to_s, hrs in [("Created","PreAuth",80), ("PreAuth","Submission",76), ("Submission","Approval",54), ("Approval","Admission",30), ("Admission","BillGeneration",6)]:
        db.add(StateTransition(case_id=c2.id, from_stage=from_s, to_stage=to_s, action=f"advanced_to_{to_s}", performed_by="billing_staff", created_at=datetime.utcnow() - timedelta(hours=hrs)))

    # ─── CASE 3: Priya Mehta — Maternity (Approval stage) ────────────────
    p3 = Patient(name="Priya Mehta", age="29", gender="Female", patient_id_external="MRN-1155")
    db.add(p3)
    db.flush()

    c3 = Case(
        case_number="SAM-2026-00003", patient_id=p3.id, current_stage="Approval",
        status="active", tpa_name="HDFC ERGO", policy_number="HE-MAT-2025-556677",
        insurance_company="HDFC ERGO Health",
        primary_diagnosis="Full-term pregnancy, planned LSCS", primary_diagnosis_code="O82",
        primary_procedure="Cesarean Section (LSCS)", primary_procedure_code="59510",
    )
    db.add(c3)
    db.flush()

    pa3 = PreAuth(case_id=c3.id, requested_amount=Decimal("80000"), approval_status="pending",
                  submitted_at=datetime.utcnow() - timedelta(hours=12))
    db.add(pa3)

    for from_s, to_s, hrs in [("Created","PreAuth",24), ("PreAuth","Submission",18)]:
        db.add(StateTransition(case_id=c3.id, from_stage=from_s, to_stage=to_s, action=f"advanced_to_{to_s}", performed_by="billing_staff", created_at=datetime.utcnow() - timedelta(hours=hrs)))

    # ─── CASE 4: Rahul Sharma — Respiratory (PreAuth stage) ──────────────
    p4 = Patient(name="Rahul Sharma", age="28", gender="Male", patient_id_external="MRN-2901")
    db.add(p4)
    db.flush()

    c4 = Case(
        case_number="SAM-2026-00004", patient_id=p4.id, current_stage="PreAuth",
        status="active", tpa_name="Bajaj Allianz", policy_number="BA-2025-998877",
        insurance_company="Bajaj Allianz General",
        primary_diagnosis="Acute Bronchitis", primary_diagnosis_code="J20.9",
    )
    db.add(c4)
    db.flush()

    pa4 = PreAuth(case_id=c4.id, requested_amount=Decimal("35000"), approval_status="pending")
    db.add(pa4)

    db.add(StateTransition(case_id=c4.id, from_stage="Created", to_stage="PreAuth", action="case_created", performed_by="system", created_at=datetime.utcnow() - timedelta(hours=2)))

    d4 = Document(filename="Rahul Sharma — Prescription.jpg", status="done", pipeline_step="done",
                  confidence_score=0.85, case_id=c4.id, doc_type="pre_auth",
                  extracted_json=json.dumps({"patient_name": "Rahul Sharma", "patient_age": "28", "patient_gender": "Male", "patient_id": "MRN-2901", "raw_text": "Rx Rahul Sharma 28M. Dx: Acute Bronchitis J20.9. Azithromycin 500mg x5d."}),
                  created_at=datetime.utcnow() - timedelta(hours=2))
    db.add(d4)
    db.flush()
    db.add_all([
        ClinicalEntity(document_id=d4.id, entity_text="Acute Bronchitis", entity_type="DIAGNOSIS", coded_value="J20.9", code_system="ICD10", confidence=0.82),
        ClinicalEntity(document_id=d4.id, entity_text="Azithromycin 500mg", entity_type="MEDICATION", normalized_value="Azithromycin", confidence=0.90),
    ])

    # ─── CASE 5: Suresh Reddy — Orthopedic (Reconciliation stage) ────────
    p5 = Patient(name="Suresh Reddy", age="55", gender="Male", patient_id_external="MRN-6612")
    db.add(p5)
    db.flush()

    c5 = Case(
        case_number="SAM-2026-00005", patient_id=p5.id, current_stage="Reconciliation",
        status="active", tpa_name="New India Assurance", policy_number="NIA-2024-334455",
        insurance_company="New India Assurance",
        primary_diagnosis="Osteoarthritis Right Knee", primary_diagnosis_code="M17.11",
        primary_procedure="Total Knee Replacement", primary_procedure_code="27447",
        admission_date=datetime.utcnow() - timedelta(days=10),
        discharge_date=datetime.utcnow() - timedelta(days=3),
    )
    db.add(c5)
    db.flush()

    pa5 = PreAuth(case_id=c5.id, requested_amount=Decimal("350000"), approved_amount=Decimal("280000"),
                  approval_status="approved", approval_reference="NIA-TKR-2026-001",
                  submitted_at=datetime.utcnow() - timedelta(days=12),
                  approved_at=datetime.utcnow() - timedelta(days=11))
    db.add(pa5)

    bill5 = Bill(case_id=c5.id, bill_number="BILL-SAM-2026-00005-001", bill_type="final",
                 total_amount=Decimal("320000"), status="submitted")
    db.add(bill5)
    db.flush()
    db.add_all([
        BillItem(bill_id=bill5.id, description="Total Knee Replacement", code="27447", category="surgery", quantity=1, unit_price=Decimal("180000"), amount=Decimal("180000")),
        BillItem(bill_id=bill5.id, description="Knee Implant (Smith & Nephew)", code="", category="consumable", quantity=1, unit_price=Decimal("85000"), amount=Decimal("85000")),
        BillItem(bill_id=bill5.id, description="Room (7 days)", code="", category="room", quantity=7, unit_price=Decimal("5000"), amount=Decimal("35000")),
        BillItem(bill_id=bill5.id, description="Physiotherapy", code="", category="procedure", quantity=5, unit_price=Decimal("1000"), amount=Decimal("5000")),
        BillItem(bill_id=bill5.id, description="Medicines & Consumables", code="", category="pharmacy", quantity=1, unit_price=Decimal("15000"), amount=Decimal("15000")),
    ])

    s5 = Settlement(case_id=c5.id, billed_amount=Decimal("320000"), approved_amount=Decimal("280000"),
                    settled_amount=Decimal("248000"), total_deductions=Decimal("72000"),
                    patient_liability=Decimal("72000"), status="partial")
    db.add(s5)
    db.flush()
    db.add_all([
        Deduction(settlement_id=s5.id, reason="Billed exceeds approved amount", category="excess", amount=Decimal("40000")),
        Deduction(settlement_id=s5.id, reason="Implant rate cap exceeded", category="disallowance", amount=Decimal("25000")),
        Deduction(settlement_id=s5.id, reason="Non-payable physiotherapy sessions", category="policy_exclusion", amount=Decimal("3000")),
        Deduction(settlement_id=s5.id, reason="Proportional deduction", category="proportional", amount=Decimal("4000")),
    ])

    for from_s, to_s, hrs in [("Created","PreAuth",264), ("PreAuth","Submission",260), ("Submission","Approval",240), ("Approval","Admission",216), ("Admission","BillGeneration",168), ("BillGeneration","Discharge",72), ("Discharge","Settlement",48), ("Settlement","Reconciliation",12)]:
        db.add(StateTransition(case_id=c5.id, from_stage=from_s, to_stage=to_s, action=f"advanced_to_{to_s}", performed_by="billing_staff", created_at=datetime.utcnow() - timedelta(hours=hrs)))

    db.commit()
    print("Demo data seeded: 5 cases across different workflow stages")
    db.close()


if __name__ == "__main__":
    seed_data()
