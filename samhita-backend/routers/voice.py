"""Voice router — STT, TTS, and LiveKit token endpoints."""
import base64
import logging
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from pydantic import BaseModel
from services.voice import generate_livekit_token, speech_to_text, text_to_speech

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/voice", tags=["voice"])


class TokenRequest(BaseModel):
    identity: str
    room: str = "samhita-consult"


class TTSRequest(BaseModel):
    text: str
    language: str = "hi-IN"
    gender: str = "female"


@router.post("/token")
def get_livekit_token(req: TokenRequest):
    """Generate a LiveKit room token for WebRTC voice calls."""
    try:
        token = generate_livekit_token(req.identity, req.room)
        return {"token": token, "url": __import__("os").getenv("LIVEKIT_URL", "")}
    except Exception as e:
        logger.error(f"Token generation failed: {e}")
        raise HTTPException(500, f"Token generation error: {str(e)}")


@router.post("/stt")
async def stt_endpoint(
    audio: UploadFile = File(...),
    language: str = Form("hi-IN"),
):
    """Speech-to-text: upload audio file, get transcription."""
    try:
        audio_bytes = await audio.read()
        fname = audio.filename or "recording.wav"
        text = await speech_to_text(audio_bytes, language, filename=fname)
        return {"text": text, "language": language}
    except Exception as e:
        logger.error(f"STT failed: {e}")
        raise HTTPException(500, f"Speech-to-text error: {str(e)}")


@router.post("/tts")
async def tts_endpoint(req: TTSRequest):
    """Text-to-speech: send text, get base64 audio back."""
    try:
        audio_bytes = await text_to_speech(req.text, req.language, req.gender)
        audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
        return {"audio": audio_b64, "format": "wav"}
    except Exception as e:
        logger.error(f"TTS failed: {e}")
        raise HTTPException(500, f"Text-to-speech error: {str(e)}")
