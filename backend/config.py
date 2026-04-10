from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parent / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    plaid_client_id: str = ""
    plaid_secret: str = ""
    # sandbox | development | production
    plaid_env: str = "sandbox"

    # ISO-3166-1 alpha-2 codes for Link (comma-separated). IN = India (e.g. ICICI).
    # Production access to regions is subject to Plaid approval — see https://plaid.com/global/
    plaid_country_codes: str = "IN"

    # Used for month labeling / docs; transaction dates from Plaid remain YYYY-MM-DD.
    display_timezone: str = "Asia/Kolkata"

    # SQLite path relative to backend dir
    database_url: str = "sqlite:///./expense_tracker.db"

    # Google AI Studio / Gemini — https://aistudio.google.com/apikey
    # Use a current model id (1.5 aliases were removed from the API for many keys).
    # See https://ai.google.dev/gemini-api/docs/models/gemini — e.g. gemini-2.5-flash-lite
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash-lite"


@lru_cache
def get_settings() -> Settings:
    return Settings()
