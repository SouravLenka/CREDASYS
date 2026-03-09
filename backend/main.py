from fastapi import FastAPI, Header, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
import os

from config import settings
from database.db import init_db
from api import upload, process, risk, cam, research, dashboard

# ─── App Initialization ───────────────────────────────────────────────────────

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/docs",
)

# ─── CORS Configuration ───────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Lifecycle ───────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    await init_db()
    logger.info("Database tables initialized.")


# ─── Auth Helper (Shared Dependency) ──────────────────────────────────────────

# Auth helper moved to api/auth.py
from api.auth import verify_firebase_token


# ─── Legacy Routes (for health) ──────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "ok", 
        "app": settings.APP_NAME, 
        "version": settings.APP_VERSION,
        "auth_enabled": settings.AUTH_ENABLED
    }

# ─── Include Modular Routers ─────────────────────────────────────────────────

app.include_router(upload.router)
app.include_router(process.router)
app.include_router(risk.router)
app.include_router(cam.router)
app.include_router(research.router)
app.include_router(research.legacy_router)
app.include_router(dashboard.router)

# ─── Main Block ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    import sys

    # Initialize Logging
    logger.remove()
    logger.add(
        sys.stderr,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
        level=settings.LOG_LEVEL,
    )
    
    port = int(os.environ.get("PORT", 8000))
    logger.info(f"Starting server on port {port}")
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=(settings.ENVIRONMENT == "development"),
        log_level=settings.LOG_LEVEL.lower(),
    )
