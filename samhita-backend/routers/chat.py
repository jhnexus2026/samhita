"""Chat router — patient-scoped AI chatbot powered by Groq/Llama."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from models.document import get_db, Document, ClinicalEntity
from services.chatbot import build_patient_context, chat
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["chat"])


class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []


@router.post("/chat/{doc_id}")
def chat_with_patient(doc_id: int, req: ChatRequest, db: Session = Depends(get_db)):
    """Chat about a specific patient's record."""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")

    # Build context from all available data
    entities = db.query(ClinicalEntity).filter(ClinicalEntity.document_id == doc_id).all()
    entity_dicts = [
        {
            "entity_text": e.entity_text,
            "entity_type": e.entity_type,
            "normalized_value": e.normalized_value,
            "coded_value": e.coded_value,
            "code_system": e.code_system,
            "code_description": e.code_description,
            "confidence": e.confidence,
            "negated": e.negated,
        }
        for e in entities
    ]

    doc_data = {
        "extracted_data": json.loads(doc.extracted_json) if doc.extracted_json else {},
        "entities": entity_dicts,
        "reconciliation_alerts": json.loads(doc.reconciliation_alerts) if doc.reconciliation_alerts else [],
        "status": doc.status,
        "confidence_score": doc.confidence_score or 0,
    }

    patient_context = build_patient_context(doc_data)

    # Build message list: history + current message
    messages = []
    for h in req.history[-10:]:  # Keep last 10 messages for context window
        messages.append({"role": h.get("role", "user"), "content": h.get("content", "")})
    messages.append({"role": "user", "content": req.message})

    try:
        reply = chat(patient_context, messages)
        return {"reply": reply, "document_id": doc_id}
    except Exception as e:
        logger.error(f"Chat failed for doc {doc_id}: {e}")
        raise HTTPException(500, f"Chat service error: {str(e)}")


@router.post("/chat/{doc_id}/stream")
async def chat_stream(doc_id: int, req: ChatRequest, db: Session = Depends(get_db)):
    """Stream chat response using Server-Sent Events."""
    from fastapi.responses import StreamingResponse
    import os

    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")

    entities = db.query(ClinicalEntity).filter(ClinicalEntity.document_id == doc_id).all()
    entity_dicts = [
        {
            "entity_text": e.entity_text,
            "entity_type": e.entity_type,
            "normalized_value": e.normalized_value,
            "coded_value": e.coded_value,
            "confidence": e.confidence,
        }
        for e in entities
    ]

    doc_data = {
        "extracted_data": json.loads(doc.extracted_json) if doc.extracted_json else {},
        "entities": entity_dicts,
        "reconciliation_alerts": json.loads(doc.reconciliation_alerts) if doc.reconciliation_alerts else [],
    }

    patient_context = build_patient_context(doc_data)

    messages = []
    for h in req.history[-10:]:
        messages.append({"role": h.get("role", "user"), "content": h.get("content", "")})
    messages.append({"role": "user", "content": req.message})

    async def generate():
        try:
            from groq import Groq
            keys = [os.getenv("GROQ_API_KEY"), os.getenv("GROQ_API_KEY_BACKUP")]
            
            for i, key in enumerate(keys):
                if not key:
                    continue
                try:
                    client = Groq(api_key=key)
                    stream = client.chat.completions.create(
                        model="llama-3.1-8b-instant",
                        messages=[
                            {"role": "system", "content": f"You are a clinical AI assistant. Answer based on this patient context:\n\n{patient_context}"},
                            *messages,
                        ],
                        temperature=0.3,
                        max_tokens=1024,
                        stream=True,
                    )
                    for chunk in stream:
                        if chunk.choices[0].delta.content:
                            yield f"data: {json.dumps({'token': chunk.choices[0].delta.content})}\n\n"
                    yield "data: [DONE]\n\n"
                    return  # Success, exit
                except Exception as e:
                    if i == 0 and ("429" in str(e) or "rate" in str(e).lower()):
                        logger.warning("Streaming: primary key rate-limited, trying backup...")
                        continue
                    raise
        except Exception as e:
            logger.error(f"Stream chat failed: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")

