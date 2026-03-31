"""Samhita Backend — FastAPI Entry Point"""
import os
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from models.document import init_db
from routers import upload, documents, review, export, analytics, alerts, chat, voice, cases, claims

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

app = FastAPI(
    title="Samhita API",
    description="AI-Powered Clinical Data Normalization Engine",
    version="1.0.0",
)

# CORS — allow frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth — Supabase JWT validation (disabled in dev when SUPABASE_URL is empty)
from middleware.auth import AuthMiddleware
app.add_middleware(AuthMiddleware)

# Include routers
app.include_router(upload.router)
app.include_router(documents.router)
app.include_router(review.router)
app.include_router(export.router)
app.include_router(analytics.router)
app.include_router(alerts.router)
app.include_router(chat.router)
app.include_router(voice.router)
app.include_router(cases.router)
app.include_router(claims.router)

# Serve uploaded files statically (for document preview)
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.on_event("startup")
def startup():
    # Ensure data directory exists
    os.makedirs(os.path.join(os.path.dirname(__file__), "data"), exist_ok=True)
    try:
        init_db()
        logging.info("Samhita API started — database initialized")
    except Exception as e:
        logging.error(f"Database init failed (will retry on first request): {e}")

    # Initialize Supabase Storage bucket
    from services.storage import is_enabled, ensure_bucket
    if is_enabled():
        ensure_bucket()
        logging.info("Supabase Storage enabled")
    else:
        logging.info("Supabase Storage disabled — using local uploads/")


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "samhita-api", "version": "1.0.0"}


@app.get("/")
def root():
    return {
        "name": "Samhita API",
        "description": "AI-Powered Clinical Data Normalization Engine",
        "docs": "/docs",
        "health": "/health",
    }
