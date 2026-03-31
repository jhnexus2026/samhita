"""FHIR R4 Bundle Builder"""
import json
import uuid
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


def _make_id():
    return str(uuid.uuid4())


def build_bundle(patient_info: dict, coded_entities: list[dict], extraction_data: dict = None) -> dict:
    """Build a FHIR R4 Bundle from extracted and coded clinical data."""
    bundle_id = _make_id()
    patient_id = _make_id()
    encounter_id = _make_id()
    timestamp = datetime.utcnow().isoformat() + "Z"

    entries = []

    # 1. Patient Resource
    patient_resource = {
        "fullUrl": f"urn:uuid:{patient_id}",
        "resource": {
            "resourceType": "Patient",
            "id": patient_id,
            "name": [{"text": patient_info.get("patient_name", "Unknown")}],
            "gender": _map_gender(patient_info.get("patient_gender", "")),
            "identifier": [
                {
                    "system": "https://healthid.ndhm.gov.in",
                    "value": patient_info.get("abha_id", f"14-{str(uuid.uuid4().int)[:4]}-{str(uuid.uuid4().int)[4:8]}-{str(uuid.uuid4().int)[8:12]}")
                }
            ],
        },
    }
    if patient_info.get("patient_id"):
        patient_resource["resource"]["identifier"].append({
            "system": "http://hospital.samhita.ai/patient",
            "value": patient_info["patient_id"],
        })
    if patient_info.get("patient_age"):
        patient_resource["resource"]["extension"] = [{
            "url": "http://samhita.ai/fhir/age",
            "valueString": patient_info["patient_age"],
        }]
    entries.append(patient_resource)

    # 2. Encounter Resource
    encounter_resource = {
        "fullUrl": f"urn:uuid:{encounter_id}",
        "resource": {
            "resourceType": "Encounter",
            "id": encounter_id,
            "status": "finished",
            "class": {
                "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                "code": "IMP",
                "display": "inpatient encounter",
            },
            "subject": {"reference": f"urn:uuid:{patient_id}"},
            "period": {},
        },
    }
    if extraction_data:
        period = {}
        if extraction_data.get("admission_date"):
            period["start"] = extraction_data["admission_date"]
        if extraction_data.get("discharge_date"):
            period["end"] = extraction_data["discharge_date"]
        encounter_resource["resource"]["period"] = period
    entries.append(encounter_resource)

    # 3. Condition Resources (Diagnoses)
    for entity in coded_entities:
        if entity.get("entity_type") != "DIAGNOSIS" or entity.get("negated"):
            continue

        condition_id = _make_id()
        condition = {
            "fullUrl": f"urn:uuid:{condition_id}",
            "resource": {
                "resourceType": "Condition",
                "id": condition_id,
                "subject": {"reference": f"urn:uuid:{patient_id}"},
                "encounter": {"reference": f"urn:uuid:{encounter_id}"},
                "code": {
                    "coding": [],
                    "text": entity.get("normalized_value") or entity.get("entity_text", ""),
                },
                "clinicalStatus": {
                    "coding": [{"system": "http://terminology.hl7.org/CodeSystem/condition-clinical", "code": "active"}]
                },
            },
        }
        if entity.get("coded_value"):
            condition["resource"]["code"]["coding"].append({
                "system": "http://hl7.org/fhir/sid/icd-10-cm",
                "code": entity["coded_value"],
                "display": entity.get("code_description", ""),
            })
        entries.append(condition)

    # 4. Procedure Resources
    for entity in coded_entities:
        if entity.get("entity_type") != "PROCEDURE":
            continue

        proc_id = _make_id()
        procedure = {
            "fullUrl": f"urn:uuid:{proc_id}",
            "resource": {
                "resourceType": "Procedure",
                "id": proc_id,
                "status": "completed",
                "subject": {"reference": f"urn:uuid:{patient_id}"},
                "encounter": {"reference": f"urn:uuid:{encounter_id}"},
                "code": {
                    "coding": [],
                    "text": entity.get("normalized_value") or entity.get("entity_text", ""),
                },
            },
        }
        if entity.get("coded_value"):
            system_url = "http://www.ama-assn.org/go/cpt" if entity.get("code_system") == "CPT" else "http://hl7.org/fhir/sid/icd-10-pcs"
            procedure["resource"]["code"]["coding"].append({
                "system": system_url,
                "code": entity["coded_value"],
                "display": entity.get("code_description", ""),
            })
        entries.append(procedure)

    # 5. Observation Resources (Labs & Vitals)
    for entity in coded_entities:
        if entity.get("entity_type") not in ("LAB_TEST", "VITAL"):
            continue

        obs_id = _make_id()
        observation = {
            "fullUrl": f"urn:uuid:{obs_id}",
            "resource": {
                "resourceType": "Observation",
                "id": obs_id,
                "status": "final",
                "subject": {"reference": f"urn:uuid:{patient_id}"},
                "encounter": {"reference": f"urn:uuid:{encounter_id}"},
                "code": {
                    "coding": [],
                    "text": entity.get("normalized_value") or entity.get("entity_text", ""),
                },
            },
        }
        if entity.get("coded_value") and entity.get("code_system") == "LOINC":
            observation["resource"]["code"]["coding"].append({
                "system": "http://loinc.org",
                "code": entity["coded_value"],
                "display": entity.get("code_description", ""),
            })

        # Try to parse value
        norm_val = entity.get("normalized_value", "")
        if ":" in norm_val:
            parts = norm_val.split(":", 1)
            val_str = parts[1].strip()
            observation["resource"]["valueString"] = val_str

        entries.append(observation)

    # 6. MedicationStatement Resources
    for entity in coded_entities:
        if entity.get("entity_type") != "MEDICATION":
            continue

        med_id = _make_id()
        med_statement = {
            "fullUrl": f"urn:uuid:{med_id}",
            "resource": {
                "resourceType": "MedicationStatement",
                "id": med_id,
                "status": "active",
                "subject": {"reference": f"urn:uuid:{patient_id}"},
                "context": {"reference": f"urn:uuid:{encounter_id}"},
                "medicationCodeableConcept": {
                    "text": entity.get("normalized_value") or entity.get("entity_text", ""),
                },
            },
        }
        entries.append(med_statement)

    # Assemble Bundle
    bundle = {
        "resourceType": "Bundle",
        "id": bundle_id,
        "type": "collection",
        "timestamp": timestamp,
        "meta": {
            "profile": ["http://hl7.org/fhir/R4/bundle.html"],
            "source": "Samhita AI Clinical Intelligence Engine",
        },
        "entry": entries,
        "total": len(entries),
    }

    return bundle


def build_claim_resource(case_data: dict, bill_data: dict, coded_entities: list[dict]) -> dict:
    """Build a FHIR R4 Claim resource from case and bill data."""
    claim_id = _make_id()
    patient_id = _make_id()

    diagnosis_entries = []
    for i, entity in enumerate(coded_entities):
        if entity.get("entity_type") != "DIAGNOSIS" or entity.get("negated"):
            continue
        diagnosis_entries.append({
            "sequence": i + 1,
            "diagnosisCodeableConcept": {
                "coding": [{
                    "system": "http://hl7.org/fhir/sid/icd-10-cm",
                    "code": entity.get("coded_value", ""),
                    "display": entity.get("code_description", entity.get("entity_text", "")),
                }] if entity.get("coded_value") else [],
                "text": entity.get("normalized_value") or entity.get("entity_text", ""),
            },
        })

    procedure_entries = []
    for i, entity in enumerate(coded_entities):
        if entity.get("entity_type") != "PROCEDURE":
            continue
        procedure_entries.append({
            "sequence": i + 1,
            "procedureCodeableConcept": {
                "coding": [{
                    "system": "http://www.ama-assn.org/go/cpt",
                    "code": entity.get("coded_value", ""),
                    "display": entity.get("code_description", entity.get("entity_text", "")),
                }] if entity.get("coded_value") else [],
                "text": entity.get("normalized_value") or entity.get("entity_text", ""),
            },
        })

    item_entries = []
    for i, item in enumerate(bill_data.get("items", [])):
        item_entries.append({
            "sequence": i + 1,
            "productOrService": {
                "coding": [{
                    "system": "http://www.ama-assn.org/go/cpt",
                    "code": item.get("code", ""),
                }] if item.get("code") else [],
                "text": item.get("description", ""),
            },
            "quantity": {"value": item.get("quantity", 1)},
            "unitPrice": {"value": item.get("unit_price", 0), "currency": "INR"},
            "net": {"value": item.get("amount", 0), "currency": "INR"},
        })

    claim = {
        "resourceType": "Claim",
        "id": claim_id,
        "status": "active",
        "type": {
            "coding": [{"system": "http://terminology.hl7.org/CodeSystem/claim-type", "code": "institutional"}]
        },
        "use": "preauthorization" if case_data.get("current_stage") in ("PreAuth", "Submission") else "claim",
        "patient": {"reference": f"urn:uuid:{patient_id}"},
        "created": datetime.utcnow().isoformat() + "Z",
        "insurer": {"display": case_data.get("tpa_name", "Unknown TPA")},
        "provider": {"display": "Samhita Demo Hospital"},
        "priority": {"coding": [{"code": "normal"}]},
        "diagnosis": diagnosis_entries,
        "procedure": procedure_entries,
        "item": item_entries,
        "total": {"value": bill_data.get("total_amount", 0), "currency": "INR"},
    }

    return claim


def build_coverage_resource(case_data: dict) -> dict:
    """Build a FHIR R4 Coverage resource from case insurance data."""
    coverage_id = _make_id()
    return {
        "resourceType": "Coverage",
        "id": coverage_id,
        "status": "active",
        "type": {
            "coding": [{"system": "http://terminology.hl7.org/CodeSystem/v3-ActCode", "code": "EHCPOL", "display": "extended healthcare"}]
        },
        "subscriber": {"display": case_data.get("patient_name", "")},
        "subscriberId": case_data.get("policy_number", ""),
        "beneficiary": {"display": case_data.get("patient_name", "")},
        "payor": [{"display": case_data.get("insurance_company", case_data.get("tpa_name", "Unknown"))}],
        "class": [
            {
                "type": {"coding": [{"code": "plan"}]},
                "value": case_data.get("policy_number", ""),
                "name": case_data.get("insurance_company", ""),
            }
        ],
    }


def build_ayushman_claim(patient_info: dict, coded_entities: list[dict], billing_items: list[dict] = None) -> dict:
    """Build Ayushman PMJAY preauthorization JSON payload."""
    diagnosis_codes = [
        e["coded_value"]
        for e in coded_entities
        if e.get("entity_type") == "DIAGNOSIS" and e.get("coded_value") and not e.get("negated")
    ]
    procedure_codes = [
        e["coded_value"]
        for e in coded_entities
        if e.get("entity_type") == "PROCEDURE" and e.get("coded_value")
    ]

    total_amount = sum(item.get("amount", 0) for item in (billing_items or []))

    claim = {
        "scheme": "PMJAY",
        "version": "2.0",
        "preauthorization": {
            "beneficiary": {
                "name": patient_info.get("patient_name", ""),
                "age": patient_info.get("patient_age", ""),
                "gender": patient_info.get("patient_gender", ""),
                "beneficiary_id": patient_info.get("patient_id", ""),
                "abha_id": patient_info.get("abha_id", f"14-{str(uuid.uuid4().int)[:4]}-XXXX-XXXX"),
            },
            "hospital": {
                "hospital_code": "SAMHITA_DEMO",
                "hospital_name": "Demo Hospital",
            },
            "clinical": {
                "primary_diagnosis_icd": diagnosis_codes[0] if diagnosis_codes else "",
                "secondary_diagnoses_icd": diagnosis_codes[1:],
                "procedure_codes": procedure_codes,
                "admission_date": patient_info.get("admission_date", ""),
                "discharge_date": patient_info.get("discharge_date", ""),
            },
            "financial": {
                "claim_amount": total_amount,
                "package_code": "",
                "billing_items": billing_items or [],
            },
            "generated_by": "Samhita AI",
            "generated_at": datetime.utcnow().isoformat(),
        },
    }

    return claim


def _map_gender(gender_str: str) -> str:
    g = gender_str.lower().strip()
    if g in ("m", "male"):
        return "male"
    elif g in ("f", "female"):
        return "female"
    return "unknown"
