"""Pipeline Orchestrator — Chains all AI services together"""
import json
import logging
from datetime import datetime
from models.document import SessionLocal, Document, ClinicalEntity
from services.vision import extract_multi_page
from services.nlp import extract_entities
from services.code_mapper import map_all_entities
from services.fhir_builder import build_bundle, build_ayushman_claim
from services.reconciler import reconcile
from services.alerting import create_alert_if_needed

logger = logging.getLogger(__name__)


def _update_status(db, doc: Document, status: str, step: str):
    doc.status = status
    doc.pipeline_step = step
    doc.updated_at = datetime.utcnow()
    db.commit()


def run_pipeline(doc_id: int, page_paths: list[str]):
    """
    Full AI processing pipeline:
    1. Vision AI extraction (Gemini)
    2. Clinical NLP (Groq/Llama)
    3. Medical code mapping (FAISS)
    4. FHIR R4 bundle building
    5. Billing reconciliation
    6. Severity alerting
    """
    db = SessionLocal()
    try:
        doc = db.query(Document).filter(Document.id == doc_id).first()
        if not doc:
            logger.error(f"Document {doc_id} not found")
            return

        logger.info(f"Starting pipeline for document {doc_id}: {doc.filename}")

        # --- Step 1: Text Ingestion or Vision Extraction ---
        _update_status(db, doc, "processing", "extracting")
        try:
            if len(page_paths) == 1 and page_paths[0].lower().endswith(".txt"):
                logger.info(f"Doc {doc_id}: Found plain text file, bypassing Vision OCR")
                with open(page_paths[0], "r", encoding="utf-8") as f:
                    raw_text = f.read()
                extraction_data = {
                    "raw_text": raw_text, 
                    "patient_name": "Pasted Patient Data", 
                    "patient_age": "", 
                    "patient_id": "P-TXT", 
                    "patient_gender": "",
                    "admission_date": "",
                    "discharge_date": "",
                    "billing_items": []
                }
            else:
                logger.info(f"Doc {doc_id}: Calling Gemini Vision API for extraction")
                extraction_data = extract_multi_page(page_paths)
            
            doc.doc_type = extraction_data.get("doc_type", "general")
            doc.extracted_json = json.dumps(extraction_data, ensure_ascii=False)

            # Update document filename with patient name for easy identification
            patient_name = (extraction_data.get("patient_name") or "").strip()
            skip_names = {"", "unknown", "pasted patient data", "n/a", "na"}
            if patient_name and patient_name.lower() not in skip_names:
                # Only prepend if patient name isn't already in the filename
                if patient_name.lower() not in doc.filename.lower():
                    doc.filename = f"{patient_name} — {doc.filename}"
                    logger.info(f"Doc {doc_id}: Renamed to '{doc.filename}'")

            db.commit()
            logger.info(f"Doc {doc_id}: Basic extraction complete")
        except Exception as e:
            logger.error(f"Doc {doc_id}: Vision extraction failed: {e}")
            doc.error_message = f"Vision extraction failed: {str(e)}"
            _update_status(db, doc, "error", "extracting")
            return

        # --- Step 2: Clinical NLP ---
        _update_status(db, doc, "processing", "analyzing")
        try:
            raw_text = extraction_data.get("raw_text", "")
            if not raw_text or len(raw_text.strip()) < 10:
                logger.warning(f"Doc {doc_id}: Vision returned insufficient text, skipping NLP")
                entities = []
            else:
                entities = extract_entities(raw_text)
            logger.info(f"Doc {doc_id}: NLP extracted {len(entities)} entities")

            # For text uploads: try to extract patient name from NLP entities
            skip_names = {"", "unknown", "pasted patient data", "n/a", "na"}
            current_patient = (extraction_data.get("patient_name") or "").strip()
            if current_patient.lower() in skip_names:
                for ent in entities:
                    if ent.get("entity_type") == "DEMOGRAPHIC":
                        nv = ent.get("normalized_value", "")
                        if "patient name:" in nv.lower():
                            name = nv.split(":", 1)[1].strip()
                            if name and name.lower() not in skip_names:
                                extraction_data["patient_name"] = name
                                if name.lower() not in doc.filename.lower():
                                    doc.filename = f"{name} — {doc.filename}"
                                    db.commit()
                                    logger.info(f"Doc {doc_id}: Updated filename from NLP to '{doc.filename}'")
                                break
        except Exception as e:
            logger.error(f"Doc {doc_id}: NLP extraction failed: {e}")
            doc.error_message = f"NLP extraction failed: {str(e)}"
            _update_status(db, doc, "error", "analyzing")
            return

        # --- Step 3: Code Mapping ---
        _update_status(db, doc, "processing", "mapping")
        try:
            coded_entities = map_all_entities(entities)
            doc.coded_json = json.dumps(coded_entities, ensure_ascii=False)
            db.commit()
            logger.info(f"Doc {doc_id}: Code mapping complete")
        except Exception as e:
            logger.error(f"Doc {doc_id}: Code mapping failed: {e}")
            # Continue with unmapped entities
            coded_entities = [{**e, "coded_value": None, "similarity_score": 0, "needs_review": True} for e in entities]
            doc.coded_json = json.dumps(coded_entities, ensure_ascii=False)
            db.commit()

        # Save entities to database
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

        # Calculate overall confidence
        confidences = [ce.get("similarity_score", ce.get("confidence", 0)) for ce in coded_entities]
        doc.confidence_score = sum(confidences) / len(confidences) if confidences else 0

        # --- Step 4: FHIR Bundle ---
        _update_status(db, doc, "processing", "structuring")
        try:
            patient_info = {
                "patient_name": extraction_data.get("patient_name", ""),
                "patient_age": extraction_data.get("patient_age", ""),
                "patient_id": extraction_data.get("patient_id", ""),
                "patient_gender": extraction_data.get("patient_gender", ""),
                "admission_date": extraction_data.get("admission_date", ""),
                "discharge_date": extraction_data.get("discharge_date", ""),
            }

            fhir_bundle = build_bundle(patient_info, coded_entities, extraction_data)
            doc.fhir_json = json.dumps(fhir_bundle, ensure_ascii=False)

            # Ayushman PMJAY claim
            billing_items = extraction_data.get("billing_items", [])
            ayushman = build_ayushman_claim(patient_info, coded_entities, billing_items)
            doc.ayushman_json = json.dumps(ayushman, ensure_ascii=False)

            db.commit()
            logger.info(f"Doc {doc_id}: FHIR bundle and Ayushman claim built")
        except Exception as e:
            logger.error(f"Doc {doc_id}: FHIR building failed: {e}")
            # Non-fatal, continue

        # --- Step 5: Billing Reconciliation ---
        _update_status(db, doc, "processing", "reconciling")
        try:
            billing_items = extraction_data.get("billing_items", [])
            recon_alerts = reconcile(coded_entities, billing_items)
            doc.reconciliation_alerts = json.dumps(recon_alerts, ensure_ascii=False)
            db.commit()
            logger.info(f"Doc {doc_id}: Reconciliation found {len(recon_alerts)} alerts")
        except Exception as e:
            logger.error(f"Doc {doc_id}: Reconciliation failed: {e}")

        # --- Step 6: Severity Alerting ---
        try:
            alert_result = create_alert_if_needed(doc_id, coded_entities, extraction_data)
            if alert_result:
                logger.warning(f"Doc {doc_id}: Patient alert created — {alert_result['severity']}")
        except Exception as e:
            logger.error(f"Doc {doc_id}: Alerting failed: {e}")

        # --- Done ---
        final_status = "needs_review" if has_review else "done"
        _update_status(db, doc, final_status, "complete")
        logger.info(f"Doc {doc_id}: Pipeline complete — status={final_status}, confidence={doc.confidence_score:.2f}")

    except Exception as e:
        logger.error(f"Doc {doc_id}: Pipeline crashed: {e}")
        try:
            doc.error_message = str(e)
            _update_status(db, doc, "error", doc.pipeline_step or "unknown")
        except Exception:
            pass
    finally:
        db.close()
