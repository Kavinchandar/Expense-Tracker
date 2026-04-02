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


@lru_cache
def get_settings() -> Settings:
    return Settings()
