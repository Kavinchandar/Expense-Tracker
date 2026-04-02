"""Thin wrappers around the Plaid HTTP SDK (no app or DB logic)."""

from __future__ import annotations

from typing import Any, Optional, Tuple

from plaid.api.plaid_api import PlaidApi
from plaid.model.country_code import CountryCode
from plaid.model.item_get_request import ItemGetRequest
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.products import Products
from plaid.model.transactions_get_request import TransactionsGetRequest
from plaid.model.transactions_get_request_options import TransactionsGetRequestOptions

from config import get_settings

CLIENT_USER_ID = "local-user"
LINK_CLIENT_NAME = "Expense Tracker"


def _country_codes_from_settings() -> list[CountryCode]:
    raw = get_settings().plaid_country_codes
    parts = [p.strip().upper() for p in raw.split(",") if p.strip()]
    if not parts:
        parts = ["IN"]
    return [CountryCode(code) for code in parts]


def create_link_token(client: PlaidApi) -> str:
    req = LinkTokenCreateRequest(
        client_name=LINK_CLIENT_NAME,
        language="en",
        country_codes=_country_codes_from_settings(),
        user=LinkTokenCreateRequestUser(client_user_id=CLIENT_USER_ID),
        products=[Products("transactions")],
    )
    res = client.link_token_create(req)
    return res.link_token


def exchange_public_token(
    client: PlaidApi, public_token: str
) -> Tuple[str, str, Optional[str]]:
    ex = client.item_public_token_exchange(
        ItemPublicTokenExchangeRequest(public_token=public_token)
    )
    access_token = ex.access_token
    item_id = ex.item_id
    ig = client.item_get(ItemGetRequest(access_token=access_token))
    item = ig.item
    institution_name = getattr(item, "institution_name", None) if item else None
    return access_token, item_id, institution_name


def _transaction_to_row(tx: Any) -> dict[str, Any]:
    pfc = tx.personal_finance_category
    primary = "UNCATEGORIZED"
    detailed = None
    if pfc is not None:
        primary = getattr(pfc, "primary", None) or primary
        detailed = getattr(pfc, "detailed", None)
    d = tx.date
    date_str = d.isoformat() if hasattr(d, "isoformat") else str(d)
    return {
        "transaction_id": tx.transaction_id,
        "date": date_str,
        "name": tx.name,
        "amount": float(tx.amount) if tx.amount is not None else 0.0,
        "merchant_name": getattr(tx, "merchant_name", None),
        "primary_category": primary,
        "detailed_category": detailed,
        "pending": bool(getattr(tx, "pending", False)),
    }


def fetch_transactions_for_range(
    client: PlaidApi, access_token: str, start, end
) -> list[dict[str, Any]]:
    """Paginate /transactions/get for the inclusive date range."""
    out: list[dict[str, Any]] = []
    offset = 0
    count = 500
    while True:
        opts = TransactionsGetRequestOptions(offset=offset, count=count)
        req = TransactionsGetRequest(
            access_token=access_token,
            start_date=start,
            end_date=end,
            options=opts,
        )
        res = client.transactions_get(req)
        batch = res.transactions or []
        for tx in batch:
            out.append(_transaction_to_row(tx))
        total = res.total_transactions if res.total_transactions is not None else len(batch)
        offset += len(batch)
        if not batch or offset >= total:
            break
    return out
