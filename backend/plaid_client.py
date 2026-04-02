from functools import lru_cache

from plaid.api.plaid_api import PlaidApi
from plaid.api_client import ApiClient
from plaid.configuration import Configuration, Environment

from config import get_settings


def _host_for_env(env: str) -> str:
    e = env.lower()
    if e == "sandbox":
        return Environment.Sandbox
    if e == "production":
        return Environment.Production
    # development uses same host as sandbox in Plaid docs
    return Environment.Sandbox


@lru_cache
def get_plaid_api() -> PlaidApi:
    settings = get_settings()
    if not settings.plaid_client_id or not settings.plaid_secret:
        raise RuntimeError("PLAID_CLIENT_ID and PLAID_SECRET must be set in .env")

    configuration = Configuration(
        host=_host_for_env(settings.plaid_env),
        api_key={
            "clientId": settings.plaid_client_id,
            "secret": settings.plaid_secret,
        },
    )
    api_client = ApiClient(configuration)
    return PlaidApi(api_client)
