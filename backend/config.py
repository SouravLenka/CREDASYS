"""
Configuration settings for CREDASYS Backend.
Loads environment variables and exposes typed settings.
"""
import os
from functools import lru_cache
from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    APP_NAME: str = "CREDASYS"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost:5432/credasys"

    # AI / LLM
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    OPENAI_API_KEY: str = ""
    SERPAPI_API_KEY: str = ""

    # ChromaDB
    CHROMA_PERSIST_DIR: str = "./data/chroma"

    # File Storage
    UPLOAD_DIR: str = "./data/uploads"
    MAX_FILE_SIZE_MB: int = 50

    # Firebase (for auth token verification)
    FIREBASE_PROJECT_ID: str = ""
    FIREBASE_CREDENTIALS_PATH: str = "./firebase-credentials.json"

    # CORS
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000", "https://your-frontend.vercel.app"]

    # Security
    AUTH_ENABLED: bool = True

    # Logging
    LOG_LEVEL: str = "INFO"

    @field_validator("DEBUG", mode="before")
    @classmethod
    def normalize_debug(cls, value):
        """Allow non-boolean env strings like 'release' without crashing."""
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            lowered = value.strip().lower()
            if lowered in {"1", "true", "yes", "on", "debug", "development"}:
                return True
            if lowered in {"0", "false", "no", "off", "release", "prod", "production"}:
                return False
        return False

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()


settings = get_settings()

