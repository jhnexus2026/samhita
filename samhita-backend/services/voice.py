"""Voice service — Sarvam AI STT/TTS + LiveKit token generation."""
import os
import base64
import logging
import httpx

logger = logging.getLogger(__name__)

SARVAM_API_KEY = os.getenv("SARVAM_API_KEY", "")
SARVAM_BASE = "https://api.sarvam.ai"
LIVEKIT_URL = os.getenv("LIVEKIT_URL", "")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", "")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "")


def generate_livekit_token(identity: str, room: str) -> str:
    """Generate a LiveKit access token for a user to join a room."""
    from livekit import api as lk_api
    token = lk_api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
    token.with_identity(identity)
    token.with_grants(lk_api.VideoGrants(room_join=True, room=room))
    return token.to_jwt()


async def speech_to_text(audio_bytes: bytes, language: str = "hi-IN", filename: str = "recording.wav") -> str:
    """Convert speech audio to text using Sarvam AI (multipart file upload)."""
    if not SARVAM_API_KEY:
        raise ValueError("SARVAM_API_KEY not set — add SARVAM_API_KEY to your .env file")

    # Detect content type from filename
    if filename.endswith(".wav"):
        content_type = "audio/wav"
    elif filename.endswith(".webm"):
        content_type = "audio/webm"
    elif filename.endswith(".mp3"):
        content_type = "audio/mpeg"
    elif filename.endswith(".ogg"):
        content_type = "audio/ogg"
    else:
        content_type = "audio/wav"  # default

    logger.info(f"STT request: filename={filename}, content_type={content_type}, audio_size={len(audio_bytes)} bytes, language={language}")

    models_to_try = ["saarika:v2.5", "saaras:v3"]

    # Sarvam natively supports 10 major languages; fallback regional dialects like Bhojpuri to Hindi for STT
    sarvam_lang = language if language in ["hi-IN", "bn-IN", "gu-IN", "kn-IN", "ml-IN", "mr-IN", "or-IN", "pa-IN", "ta-IN", "te-IN", "en-IN"] else "hi-IN"

    async with httpx.AsyncClient(timeout=30) as client:
        last_error = None
        for model in models_to_try:
            try:
                resp = await client.post(
                    f"{SARVAM_BASE}/speech-to-text",
                    headers={"api-subscription-key": SARVAM_API_KEY},
                    files={"file": (filename, audio_bytes, content_type)},
                    data={
                        "language_code": sarvam_lang,
                        "model": model,
                    },
                )

                if resp.status_code == 200:
                    data = resp.json()
                    logger.info(f"Sarvam STT success (model={model}): {data}")
                    return data.get("transcript", "")
                else:
                    last_error = f"Model {model} returned {resp.status_code}: {resp.text}"
                    logger.warning(f"Sarvam STT {last_error}")
            except Exception as e:
                last_error = f"Model {model} exception: {e}"
                logger.warning(f"Sarvam STT {last_error}")

        raise RuntimeError(f"All Sarvam STT models failed. Last error: {last_error}")


async def text_to_speech(text: str, language: str = "hi-IN", gender: str = "female") -> bytes:
    """Convert text to speech audio using Sarvam AI."""
    if not SARVAM_API_KEY:
        raise ValueError("SARVAM_API_KEY not set")

    # Map language to Sarvam speaker
    default_f = "anushka"
    default_m = "abhilash"
    speaker_map = {
        "hi-IN": default_f if gender == "female" else default_m,
        "en-IN": default_f if gender == "female" else default_m,
        "bn-IN": default_f,
        "ta-IN": default_f,
        "te-IN": default_f,
        "mr-IN": default_f,
        "gu-IN": default_f,
        "kn-IN": default_f,
        "ml-IN": default_f,
        "pa-IN": default_f,
    }
    speaker = speaker_map.get(language, default_f)
    
    # Sarvam natively supports 10 major languages; fallback regional dialects to Hindi for TTS
    sarvam_lang = language if language in ["hi-IN", "bn-IN", "gu-IN", "kn-IN", "ml-IN", "mr-IN", "or-IN", "pa-IN", "ta-IN", "te-IN", "en-IN"] else "hi-IN"

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{SARVAM_BASE}/text-to-speech",
            headers={
                "api-subscription-key": SARVAM_API_KEY,
                "Content-Type": "application/json",
            },
            json={
                "inputs": [text[:500]],  # Sarvam limits text length
                "target_language_code": sarvam_lang,
                "speaker": speaker,
                "model": "bulbul:v1",
            },
        )

        if resp.status_code != 200:
            logger.error(f"Sarvam TTS error {resp.status_code}: {resp.text}")
            resp.raise_for_status()

        data = resp.json()
        logger.info(f"Sarvam TTS response keys: {data.keys()}")
        
        # Response format: {"audios": ["base64_encoded_audio"]}
        audios = data.get("audios", [])
        if audios:
            return base64.b64decode(audios[0])
        return b""

